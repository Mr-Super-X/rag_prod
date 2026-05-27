import type { FastifyInstance } from "fastify";
import { authenticate, requireKBAccess } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import {
  listKBs,
  createKB,
  getKB,
  updateKB,
  deleteKB,
} from "../services/kb.service.js";

const kbBody = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
  },
} as const;

const kbPatchBody = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
  },
} as const;

export async function kbRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authenticate);

  app.get("/api/kb", async (request) => {
    const kbs = await listKBs(request.user!.id);
    return { success: true, data: kbs };
  });

  app.post("/api/kb", { schema: { body: kbBody } }, async (request, reply) => {
    const { name, description } = request.body as { name: string; description?: string };
    const kb = await createKB({ name, description }, request.user!.id);
    logAudit(request.user!.id, "create_kb", "knowledge_base", kb.id).catch(() => {});
    return reply.status(201).send({ success: true, data: kb });
  });

  app.get("/api/kb/:id", { preHandler: [requireKBAccess] }, async (request) => {
    const { id } = request.params as { id: string };
    const kb = await getKB(id);
    return { success: true, data: kb };
  });

  app.patch("/api/kb/:id", { schema: { body: kbPatchBody }, preHandler: [requireKBAccess] }, async (request) => {
    const { id } = request.params as { id: string };
    const input = request.body as { name?: string; description?: string };
    const kb = await updateKB(id, input, request.user!.id);
    return { success: true, data: kb };
  });

  app.delete("/api/kb/:id", { preHandler: [requireKBAccess] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteKB(id, request.user!.id, request.user!.role);
    logAudit(request.user!.id, "delete_kb", "knowledge_base", id).catch(() => {});
    return reply.status(204).send();
  });

  // 成员列表
  app.get("/api/kb/:id/members", { preHandler: [requireKBAccess] }, async (request) => {
    const { id: kbId } = request.params as { id: string };
    const members = await db.select({
      id: schema.kbMembers.id,
      userId: schema.kbMembers.userId,
      username: schema.users.username,
      role: schema.kbMembers.role,
    }).from(schema.kbMembers)
      .innerJoin(schema.users, eq(schema.kbMembers.userId, schema.users.id))
      .where(eq(schema.kbMembers.kbId, kbId));
    return { success: true, data: members };
  });

  // 添加成员
  app.post("/api/kb/:id/members", { preHandler: [requireKBAccess] }, async (request, reply) => {
    const { id: kbId } = request.params as { id: string };
    const { username } = request.body as { username: string };
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    if (!user) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "User not found" } });

    const [existing] = await db.select().from(schema.kbMembers).where(
      and(eq(schema.kbMembers.kbId, kbId), eq(schema.kbMembers.userId, user.id))
    ).limit(1);
    if (existing) return reply.status(409).send({ success: false, error: { code: "ALREADY_MEMBER", message: "Already a member" } });

    await db.insert(schema.kbMembers).values({ kbId, userId: user.id, role: "member" });
    return reply.status(201).send({ success: true, data: { userId: user.id, username, role: "member" } });
  });

  // 移除成员
  app.delete("/api/kb/:id/members/:userId", { preHandler: [requireKBAccess] }, async (request, reply) => {
    const { id: kbId, userId } = request.params as { id: string; userId: string };
    await db.delete(schema.kbMembers).where(
      and(eq(schema.kbMembers.kbId, kbId), eq(schema.kbMembers.userId, userId), eq(schema.kbMembers.role, "member"))
    );
    return reply.status(204).send();
  });
}
