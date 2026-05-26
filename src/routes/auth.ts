import type { FastifyInstance } from "fastify";
import { register, login, generateRefreshToken, refreshAccessToken } from "../services/auth.service.js";

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
}
