import type { FastifyInstance } from "fastify";
import { authenticate, requireKBAccess } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { processDocument, processDocumentAsync, listDocuments, deleteDocument, getDocPreview } from "../services/doc.service.js";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { invalidateKB } from "../lib/cache.js";
import { config } from "../config.js";
import fs from "node:fs/promises";
import path from "node:path";

export async function docRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authenticate);

  // 上传文档
  app.post("/api/kb/:id/docs", { preHandler: [requireKBAccess] }, async (request, reply) => {
    const { id: kbId } = request.params as { id: string };

    const [kb] = await db.select({ migrationStatus: schema.knowledgeBases.migrationStatus })
      .from(schema.knowledgeBases).where(eq(schema.knowledgeBases.id, kbId)).limit(1);
    if (kb?.migrationStatus === "migrating") {
      return reply.status(503).send({ success: false, error: { code: "KB_MIGRATING", message: "知识库正在向量迁移中，请稍后重试" } });
    }

    const file = await request.file();

    if (!file) {
      return reply.status(400).send({ success: false, error: { code: "NO_FILE", message: "No file uploaded" } });
    }

    const ext = path.extname(file.filename);
    const allowedExts = [".pdf", ".docx", ".xlsx", ".pptx", ".md", ".txt"];
    if (!allowedExts.includes(ext.toLowerCase())) {
      return reply.status(400).send({
        success: false,
        error: { code: "UNSUPPORTED_TYPE", message: `Unsupported file type: ${ext}. Allowed: ${allowedExts.join(", ")}` },
      });
    }

    // 读取文件 + 大小校验
    const buffer = await file.toBuffer();
    if (buffer.length > config.MAX_FILE_SIZE_MB * 1024 * 1024) {
      return reply.status(413).send({
        success: false,
        error: { code: "FILE_TOO_LARGE", message: `File exceeds ${config.MAX_FILE_SIZE_MB}MB limit` },
      });
    }

    // 保存文件
    const uploadDir = path.resolve(config.UPLOAD_DIR);
    await fs.mkdir(uploadDir, { recursive: true });
    const destPath = path.join(uploadDir, `${Date.now()}_${file.filename}`);
    await fs.writeFile(destPath, buffer);

    // 创建记录 + 立即返回，后台异步处理
    const docId = await processDocument(
      kbId,
      destPath,
      file.filename,
      ext,
      buffer.length,
      request.user!.id,
    );

    logAudit(request.user!.id, "upload_doc", "document", docId).catch(() => {});
    invalidateKB(kbId).catch(() => {});
    return reply.status(201).send({
      success: true,
      data: { id: docId, filename: file.filename, status: "processing", chunkCount: 0 },
    });
  });

  // 文档列表
  app.get("/api/kb/:id/docs", { preHandler: [requireKBAccess] }, async (request) => {
    const { id: kbId } = request.params as { id: string };
    const docs = await listDocuments(kbId);
    return { success: true, data: docs };
  });

  // 文档预览
  app.get("/api/kb/:id/docs/:docId/preview", { preHandler: [requireKBAccess] }, async (request, reply) => {
    const { docId } = request.params as { docId: string };
    const offset = parseInt((request.query as Record<string, string>).offset || "0", 10);
    const limit = Math.min(parseInt((request.query as Record<string, string>).limit || "50", 10), 200);
    try {
      const preview = await getDocPreview(docId, offset, limit);
      return { success: true, data: preview };
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e.statusCode === 400) {
        return reply.status(400).send({ success: false, error: { code: "NOT_READY", message: e.message } });
      }
      throw err;
    }
  });

  // 删除文档
  app.delete("/api/kb/:id/docs/:docId", { preHandler: [requireKBAccess] }, async (request, reply) => {
    const { id: kbId, docId } = request.params as { id: string; docId: string };
    await deleteDocument(kbId, docId);
    logAudit(request.user!.id, "delete_doc", "document", docId).catch(() => {});
    invalidateKB(kbId).catch(() => {});
    return reply.status(204).send();
  });

  // 重新处理失败文档
  app.post("/api/kb/:id/docs/:docId/retry", { preHandler: [requireKBAccess] }, async (request, reply) => {
    const { docId, id: kbId } = request.params as { docId: string; id: string };

    const [kb] = await db.select({ migrationStatus: schema.knowledgeBases.migrationStatus })
      .from(schema.knowledgeBases).where(eq(schema.knowledgeBases.id, kbId)).limit(1);
    if (kb?.migrationStatus === "migrating") {
      return reply.status(503).send({ success: false, error: { code: "KB_MIGRATING", message: "知识库正在向量迁移中，请稍后重试" } });
    }

    // 原子操作：仅 error 状态可转为 processing，防止并发重试
    const [updated] = await db
      .update(schema.documents)
      .set({ status: "processing", errorMessage: null, progressStep: "parsing", updatedAt: new Date() })
      .where(and(eq(schema.documents.id, docId), eq(schema.documents.status, "error")))
      .returning({ id: schema.documents.id, storagePath: schema.documents.storagePath, fileType: schema.documents.fileType, filename: schema.documents.filename, kbId: schema.documents.kbId });

    if (!updated) {
      const [doc] = await db.select({ status: schema.documents.status }).from(schema.documents).where(eq(schema.documents.id, docId)).limit(1);
      if (!doc) {
        return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Document not found" } });
      }
      return reply.status(409).send({ success: false, error: { code: "NOT_ERROR", message: "Only failed documents can be retried" } });
    }

    // 清除旧 chunks 和向量
    try {
      const { deleteVectors } = await import("../lib/vectordb.js");
      const oldChunks = await db.select().from(schema.chunks).where(eq(schema.chunks.kbId, updated.kbId));
      const chunkIds = oldChunks.filter((c) => c.docId === docId).map((c) => `${docId}_${c.chunkIndex}`);
      if (chunkIds.length > 0) {
        await deleteVectors(updated.kbId, chunkIds);
      }
      await db.delete(schema.chunks).where(eq(schema.chunks.docId, docId));
    } catch {
      // 清理失败不阻塞重试
    }

    // 异步重新处理
    processDocumentAsync(docId, updated.kbId, updated.storagePath, updated.fileType, updated.filename).catch(() => {});

    return { success: true, data: { docId, status: "processing" } };
  });

  // 文档处理进度
  app.get("/api/kb/:id/docs/:docId/progress", { preHandler: [requireKBAccess] }, async (request, reply) => {
    const { docId } = request.params as { docId: string };

    const [doc] = await db
      .select({
        status: schema.documents.status,
        progressStep: schema.documents.progressStep,
        errorMessage: schema.documents.errorMessage,
        chunkCount: schema.documents.chunkCount,
      })
      .from(schema.documents)
      .where(eq(schema.documents.id, docId))
      .limit(1);

    if (!doc) {
      return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Document not found" } });
    }

    return { success: true, data: doc };
  });
}
