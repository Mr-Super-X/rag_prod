import fs from "node:fs/promises";
import path from "node:path";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
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

    // Embedding
    const texts = textChunks.map((c) => c.content);
    const vectors = await embed(texts);

    // 构建向量数据
    const ids = textChunks.map((_, i) => `${docId}_${i}`);
    const payloads = textChunks.map((chunk, i) => ({
      chunkId: `${docId}_${i}`,
      docId,
      kbId,
      content: chunk.content,
      chunkIndex: i,
      docFilename: filename,
    }));

    // 写入 LanceDB
    await insertVectors(kbId, vectors, ids, payloads);

    // 写入 PG chunks 表
    for (let i = 0; i < textChunks.length; i++) {
      await db.insert(chunks).values({
        docId,
        kbId,
        qdrantPointId: `lance_${docId}_${i}`,
        content: textChunks[i].content,
        chunkIndex: i,
        metadata: textChunks[i].metadata,
      });
    }

    // 写入 BM25 索引
    for (let i = 0; i < textChunks.length; i++) {
      await indexBM25(kbId, `${docId}_${i}`, textChunks[i].content);
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

export { documents as schema_documents } from "../db/schema.js";
