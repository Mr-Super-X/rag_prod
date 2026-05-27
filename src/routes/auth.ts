import type { FastifyInstance } from "fastify";
import { register, login, generateRefreshToken, refreshAccessToken } from "../services/auth.service.js";
import { authenticate } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { db, schema } from "../db/index.js";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "node:crypto";

const authBody = {
  type: "object",
  required: ["username", "password"],
  properties: {
    username: { type: "string" },
    password: { type: "string" },
  },
} as const;

const refreshBody = {
  type: "object",
  required: ["refreshToken"],
  properties: {
    refreshToken: { type: "string" },
  },
} as const;

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", { schema: { body: authBody } }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };
    const user = await register(username, password);
    return reply.status(201).send({ success: true, data: user });
  });

  app.post("/api/auth/login", { schema: { body: authBody } }, async (request) => {
    const { username, password } = request.body as { username: string; password: string };
    const user = await login(username, password);

    const accessToken = app.jwt.sign(user, { expiresIn: "15m" });
    const refreshToken = await generateRefreshToken(user.id);

    // 审计日志
    const ip = (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || request.ip;
    logAudit(user.id, "login", "auth", undefined, ip).catch(() => {});

    return {
      success: true,
      data: {
        token: accessToken,           // V1 兼容字段
        accessToken,                   // V2 新字段
        refreshToken,
        user,
      },
    };
  });

  app.post("/api/auth/refresh", { schema: { body: refreshBody } }, async (request) => {
    const { refreshToken } = request.body as { refreshToken: string };
    const user = await refreshAccessToken(refreshToken);

    const accessToken = app.jwt.sign(
      { id: user.userId, username: user.username, role: user.role as "admin" | "user" },
      { expiresIn: "15m" },
    );
    const newRefreshToken = await generateRefreshToken(user.userId);

    return {
      success: true,
      data: { accessToken, refreshToken: newRefreshToken },
    };
  });

  // API Key 管理（需登录）
  app.get("/api/auth/api-keys", { preHandler: [authenticate] }, async (request) => {
    const keys = await db
      .select({
        id: schema.apiKeys.id,
        keyPrefix: schema.apiKeys.keyPrefix,
        name: schema.apiKeys.name,
        lastUsedAt: schema.apiKeys.lastUsedAt,
        createdAt: schema.apiKeys.createdAt,
        revokedAt: schema.apiKeys.revokedAt,
      })
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.userId, request.user!.id))
      .orderBy(schema.apiKeys.createdAt);
    return { success: true, data: keys };
  });

  app.post("/api/auth/api-keys", { preHandler: [authenticate] }, async (request, reply) => {
    const { name } = (request.body || { name: "默认" }) as { name?: string };
    const rawKey = `ak_${crypto.randomBytes(24).toString("hex")}`;
    const keyHash = await new Promise<string>((resolve, reject) => {
      crypto.scrypt(rawKey, "apikey_salt", 32, (err, d) => (err ? reject(err) : resolve(d.toString("hex"))));
    });
    const keyPrefix = rawKey.slice(0, 8);

    const [created] = await db
      .insert(schema.apiKeys)
      .values({
        userId: request.user!.id,
        keyHash,
        keyPrefix,
        name: name || "默认",
      })
      .returning();

    return reply.status(201).send({
      success: true,
      data: { id: created.id, key: rawKey, keyPrefix, name: created.name, createdAt: created.createdAt },
    });
  });

  app.delete("/api/auth/api-keys/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db
      .update(schema.apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.userId, request.user!.id)));
    return reply.status(204).send();
  });
}
