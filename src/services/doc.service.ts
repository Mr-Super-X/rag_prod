import fs from "node:fs/promises";
import path from "node:path";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { config } from "../config.js";
import { parseFile } from "../pipeline/parser.js";
import { splitText } from "../pipeline/splitter.js";
import { embed } from "../pipeline/embedder.js";
import { insertVectors, deleteVectors } from "../lib/vectordb.js";
import { indexBM25 } from "./retrieval.service.js";
import { NotFoundError } from "../lib/errors.js";

const { documents, chunks } = schema;

export async function processDocument(
  kbId: string,
  filePath: string,
  filename: string,
  fileExt: string,
  fileSize: number,
  userId: string,
): Promise<string> {
  // 创建文档记录
  const [doc] = await db
    .insert(documents)
    .values({
      kbId,
      filename,
      fileType: fileExt.replace(".", ""),
      fileSize,
      storagePath: filePath,
      uploadedBy: userId,
      status: "processing",
    })
    .returning();

  // 异步处理（不阻塞返回）
  processDocumentAsync(doc.id, kbId, filePath, fileExt, filename).catch(() => {
    // error handled inside
  });

  return doc.id;
}

async function processDocumentAsync(
  docId: string,
  kbId: string,
  filePath: string,
  fileExt: string,
  filename: string,
): Promise<void> {
  try {
    // 解析文档
    const { text, fileType } = await parseFile(filePath);

    // 切分
    const textChunks = splitText(text, { docId, kbId, filename });

    if (textChunks.length === 0) {
      await db.update(documents).set({ status: "ready", chunkCount: 0, updatedAt: new Date() }).where(eq(documents.id, docId));
      return;
    }

    // 增量索引：比对已有 chunk 的 hash，只处理变化的部分
    let chunksToEmbed = textChunks;
    let staleIds: string[] = [];

    if (config.INCREMENTAL_INDEX) {
      const oldChunks = await db.select().from(chunks).where(eq(chunks.kbId, kbId));

      if (oldChunks.length > 0) {
        // 构建旧 chunk 的 hash 映射（来自 metadata）
        const oldHashSet = new Map<string, string>(); // hash → chunkId
        for (const oc of oldChunks) {
          const h = (oc.metadata as Record<string, unknown>)?.contentHash as string;
          if (h) oldHashSet.set(h, oc.id);
        }

        // 比对：新的 hash 在旧集合中 → 复用；不在 → 需要 embedding
        const newHashes = new Set(textChunks.map((c) => c.contentHash));
        const reusedIds = new Set<string>();

        for (const [hash, chunkId] of oldHashSet) {
          if (newHashes.has(hash)) {
            reusedIds.add(chunkId);
          }
        }

        // 不在新集合中的旧 chunk 标记为删除
        for (const oc of oldChunks) {
          const h = (oc.metadata as Record<string, unknown>)?.contentHash as string;
          if (h && !newHashes.has(h)) {
            staleIds.push(`${docId}_${oc.chunkIndex}`);
          }
        }

        // 只对新 chunk 做 embedding
        chunksToEmbed = textChunks.filter((c) => !oldHashSet.has(c.contentHash));

        // 复用未变化的 chunk：更新 PG 记录指向新 docId
        for (const oc of oldChunks) {
          const h = (oc.metadata as Record<string, unknown>)?.contentHash as string;
          if (h && reusedIds.has(oc.id)) {
            await db.update(chunks).set({
              docId,
              chunkIndex: textChunks.findIndex((tc) => tc.contentHash === h),
              metadata: { ...(oc.metadata as Record<string, unknown>), contentHash: h },
            }).where(eq(chunks.id, oc.id));
          }
        }

        // 删除失效的向量
        if (staleIds.length > 0) {
          await deleteVectors(kbId, staleIds);
        }
      }
    }

    // Embedding（只对新 chunk）
    const texts = chunksToEmbed.map((c) => c.content);
    const vectors = texts.length > 0 ? await embed(texts) : [];

    // 构建向量数据（只对新 chunk）
    const ids = chunksToEmbed.map((_, i) => `${docId}_${i}`);
    const payloads = chunksToEmbed.map((chunk, i) => ({
      chunkId: `${docId}_${i}`,
      docId,
      kbId,
      content: chunk.content,
      chunkIndex: i,
      docFilename: filename,
    }));

    // 写入 LanceDB
    if (vectors.length > 0) {
      await insertVectors(kbId, vectors, ids, payloads);
    }

    // 写入 PG chunks 表 + BM25（只对新 chunk）
    for (let i = 0; i < chunksToEmbed.length; i++) {
      await db.insert(chunks).values({
        docId,
        kbId,
        qdrantPointId: `lance_${docId}_${i}`,
        content: chunksToEmbed[i].content,
        chunkIndex: i,
        metadata: { contentHash: chunksToEmbed[i].contentHash },
      });
    }

    // 写入 BM25 索引（只对新 chunk）
    for (let i = 0; i < chunksToEmbed.length; i++) {
      await indexBM25(kbId, `${docId}_${i}`, chunksToEmbed[i].content);
    }

    await db
      .update(documents)
      .set({ status: "ready", chunkCount: textChunks.length, updatedAt: new Date() })
      .where(eq(documents.id, docId));
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(documents)
      .set({ status: "error", errorMessage, updatedAt: new Date() })
      .where(eq(documents.id, docId));
  }
}

export async function listDocuments(kbId: string) {
  return db.select().from(documents).where(eq(documents.kbId, kbId)).orderBy(schema.documents.createdAt);
}

export async function deleteDocument(kbId: string, docId: string) {
  const [doc] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
  if (!doc) throw new NotFoundError("Document", docId);

  // 删除向量
  try {
    const sliceIds = Array.from({ length: doc.chunkCount || 0 }, (_, i) => `${docId}_${i}`);
    await deleteVectors(kbId, sliceIds);
  } catch {
    // 向量删除失败不阻塞 PG 操作
  }

  // 删除物理文件
  try {
    await fs.unlink(doc.storagePath);
  } catch {
    // 文件不存在或已删除
  }

  await db.delete(documents).where(eq(documents.id, docId));
}

export interface DocPreview {
  text: string;
  filename: string;
  fileType: string;
  totalChunks: number;
  hasMore: boolean;
}

export async function getDocPreview(
  docId: string,
  offset = 0,
  limit = 50,
): Promise<DocPreview> {
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, docId)).limit(1);
  if (!doc) throw new NotFoundError("Document", docId);
  if (doc.status !== "ready") {
    throw Object.assign(new Error("文档处理中，暂不可预览"), { statusCode: 400 });
  }

  const allChunks = await db
    .select({ content: schema.chunks.content })
    .from(schema.chunks)
    .where(eq(schema.chunks.docId, docId))
    .orderBy(schema.chunks.chunkIndex)
    .offset(offset)
    .limit(limit);

  const totalChunks = doc.chunkCount || 0;

  return {
    text: allChunks.map((c) => c.content).join("\n\n"),
    filename: doc.filename,
    fileType: doc.fileType,
    totalChunks,
    hasMore: offset + limit < totalChunks,
  };
}

export { documents as schema_documents } from "../db/schema.js";
