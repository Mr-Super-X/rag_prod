import type { FastifyReply, FastifyRequest } from "fastify";

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

export function requireAdmin(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  if (request.user?.role !== "admin") {
    return reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Admin access required" },
    });
  }
  done();
}
