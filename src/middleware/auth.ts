import type { FastifyReply, FastifyRequest } from "fastify";
import { db, schema } from "../db/index.js";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "node:crypto";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; username: string; role: "admin" | "user" };
    user: { id: string; username: string; role: "admin" | "user" };
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
    });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (request.user?.role !== "admin") {
    return reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Admin access required" },
    });
  }
}

export async function requireKBAccess(request: FastifyRequest, reply: FastifyReply) {
  const { id: kbId } = request.params as { id: string };
  const userId = request.user!.id;

  // KB 创建者始终有权限
  const [kb] = await db.select().from(schema.knowledgeBases).where(eq(schema.knowledgeBases.id, kbId)).limit(1);
  if (!kb) {
    return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Knowledge base not found" } });
  }
  if (kb.createdBy === userId) return;

  // 检查是否为成员
  const members = await db
    .select()
    .from(schema.kbMembers)
    .where(and(eq(schema.kbMembers.kbId, kbId), eq(schema.kbMembers.userId, userId)))
    .limit(1);

  if (members.length === 0) {
    return reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "You don't have access to this knowledge base" },
    });
  }
}

export async function authenticateApiKey(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return;

  const key = authHeader.slice(7);
  if (!key.startsWith("ak_") || key.length < 20) return;

  const keyHash = crypto.createHmac("sha256", process.env.JWT_SECRET || "fallback-secret")
    .update(key).digest("hex");

  const [apiKey] = await db
    .select()
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.keyHash, keyHash), isNull(schema.apiKeys.revokedAt)))
    .limit(1);

  if (!apiKey) return;

  // 更新最后使用时间
  await db
    .update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, apiKey.id))
    .catch(() => { /* 非关键 */ });

  const [user] = await db
    .select({ id: schema.users.id, username: schema.users.username, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, apiKey.userId))
    .limit(1);

  if (user) {
    request.user = user as { id: string; username: string; role: "admin" | "user" };
  }
}
