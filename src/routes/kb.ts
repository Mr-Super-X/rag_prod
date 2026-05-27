import type { FastifyInstance } from "fastify";
import { authenticate, requireKBAccess } from "../middleware/auth.js";
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
    return reply.status(204).send();
  });
}
