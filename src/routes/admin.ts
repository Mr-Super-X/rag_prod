import type { FastifyInstance } from "fastify";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { db, schema } from "../db/index.js";
import { eq, count, desc, gte } from "drizzle-orm";

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireAdmin);

  // 所有用户
  app.get("/api/admin/users", async () => {
    const users = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    }).from(schema.users).orderBy(schema.users.createdAt);
    return { success: true, data: users };
  });

  // 所有知识库（含统计）
  app.get("/api/admin/kbs", async () => {
    const kbs = await db.select({
      id: schema.knowledgeBases.id,
      name: schema.knowledgeBases.name,
      createdBy: schema.knowledgeBases.createdBy,
      createdAt: schema.knowledgeBases.createdAt,
    }).from(schema.knowledgeBases).orderBy(schema.knowledgeBases.createdAt);

    // 逐 KB 查文档数和对话数
    const result = [];
    for (const kb of kbs) {
      const [docCount] = await db.select({ n: count() }).from(schema.documents).where(eq(schema.documents.kbId, kb.id));
      const [convCount] = await db.select({ n: count() }).from(schema.conversations).where(eq(schema.conversations.kbId, kb.id));
      result.push({ ...kb, docCount: docCount?.n ?? 0, convCount: convCount?.n ?? 0 });
    }
    return { success: true, data: result };
  });

  // 删除用户
  app.delete("/api/admin/users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.delete(schema.users).where(eq(schema.users.id, id));
    return reply.status(204).send();
  });

  // 强制删除 KB
  app.delete("/api/admin/kbs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.delete(schema.knowledgeBases).where(eq(schema.knowledgeBases.id, id));
    return reply.status(204).send();
  });

  // 使用概览
  app.get("/api/admin/overview", async () => {
    const [userCount] = await db.select({ n: count() }).from(schema.users);
    const [kbCount] = await db.select({ n: count() }).from(schema.knowledgeBases);
    const [docCount] = await db.select({ n: count() }).from(schema.documents);
    const [convCount] = await db.select({ n: count() }).from(schema.conversations);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayMsgs] = await db
      .select({ n: count() })
      .from(schema.messages)
      .where(gte(schema.messages.createdAt, today));

    return {
      success: true,
      data: {
        totalUsers: userCount?.n ?? 0,
        totalKBs: kbCount?.n ?? 0,
        totalDocs: docCount?.n ?? 0,
        totalConvs: convCount?.n ?? 0,
        todayQuestions: todayMsgs?.n ?? 0,
      },
    };
  });

  // 审计日志
  app.get("/api/admin/audit-logs", async (request) => {
    const { limit: rawLimit } = (request.query as Record<string, string>) || {};
    const parsed = parseInt(rawLimit || "200", 10);
    const limit = Math.min(Number.isNaN(parsed) ? 200 : parsed, 500);

    const logs = await db
      .select({
        id: schema.auditLogs.id,
        userId: schema.auditLogs.userId,
        username: schema.users.username,
        action: schema.auditLogs.action,
        resource: schema.auditLogs.resource,
        resourceId: schema.auditLogs.resourceId,
        ip: schema.auditLogs.ip,
        createdAt: schema.auditLogs.createdAt,
      })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit);

    return { success: true, data: logs };
  });

  // 反馈统计
  app.get("/api/admin/feedback-stats", async () => {
    const allFeedback = await db
      .select({
        rating: schema.messageFeedback.rating,
        username: schema.users.username,
        messageContent: schema.messages.content,
        createdAt: schema.messageFeedback.createdAt,
      })
      .from(schema.messageFeedback)
      .leftJoin(schema.users, eq(schema.messageFeedback.userId, schema.users.id))
      .leftJoin(schema.messages, eq(schema.messageFeedback.messageId, schema.messages.id))
      .orderBy(desc(schema.messageFeedback.createdAt))
      .limit(100);

    const total = allFeedback.length;
    const upCount = allFeedback.filter((f) => f.rating === 1).length;
    const rate = total > 0 ? ((upCount / total) * 100).toFixed(1) : "0";

    return {
      success: true,
      data: { total, upCount, downCount: total - upCount, rate, recent: allFeedback.slice(0, 20) },
    };
  });
}
