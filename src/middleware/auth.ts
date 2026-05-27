import type { FastifyReply, FastifyRequest } from "fastify";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";

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
