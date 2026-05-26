import type { FastifyInstance } from "fastify";
import { register, login } from "../services/auth.service.js";

const authBody = {
  type: "object",
  required: ["username", "password"],
  properties: {
    username: { type: "string" },
    password: { type: "string" },
  },
} as const;

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", { schema: { body: authBody } }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };
    const user = await register(username, password);
    return reply.status(201).send({ success: true, data: user });
  });

  app.post("/api/auth/login", { schema: { body: authBody } }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };
    const user = await login(username, password);
    const token = app.jwt.sign(user);
    return reply.send({ success: true, data: { token, user } });
  });
}
