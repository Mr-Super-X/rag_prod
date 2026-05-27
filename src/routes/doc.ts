import type { FastifyInstance } from "fastify";
import { authenticate, requireKBAccess } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { processDocument, listDocuments, deleteDocument, getDocPreview } from "../services/doc.service.js";
import { config } from "../config.js";
import fs from "node:fs/promises";
import path from "node:path";

export async function docRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authenticate);

  // 上传文档
  app.post("/api/kb/:id/docs", { preHandler: [requireKBAccess] }, async (request, reply) => {
    const { id: kbId } = request.params as { id: string };
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
    return reply.status(204).send();
  });
}
