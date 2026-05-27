import type { FastifyInstance } from "fastify";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";

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

  // 所有知识库
  app.get("/api/admin/kbs", async () => {
    const kbs = await db.select({
      id: schema.knowledgeBases.id,
      name: schema.knowledgeBases.name,
      createdBy: schema.knowledgeBases.createdBy,
      createdAt: schema.knowledgeBases.createdAt,
    }).from(schema.knowledgeBases).orderBy(schema.knowledgeBases.createdAt);
    return { success: true, data: kbs };
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
}
