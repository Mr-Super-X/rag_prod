import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/auth.js";
import { ask } from "../services/chat.service.js";
import {
  listConversations,
  getConversation,
  getMessages,
  deleteConversation,
} from "../services/context.service.js";
import type { ChatRequest } from "../types.js";

const chatBody = {
  type: "object",
  required: ["question"],
  properties: {
    question: { type: "string" },
    conversationId: { type: "string" },
  },
} as const;

export async function chatRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authenticate);

  // 问答
  app.post("/api/kb/:id/chat", { schema: { body: chatBody } }, async (request) => {
    const { id: kbId } = request.params as { id: string };
    const body = request.body as ChatRequest;
    const result = await ask(kbId, body, request.user!.id);
    return { success: true, data: result };
  });

  // 对话列表
  app.get("/api/kb/:id/conversations", async (request) => {
    const convs = await listConversations(request.user!.id);
    return { success: true, data: convs };
  });

  // 对话详情（含消息）
  app.get("/api/conversations/:id", async (request) => {
    const { id } = request.params as { id: string };
    const conv = await getConversation(id, request.user!.id);
    const msgs = await getMessages(id);
    return { success: true, data: { ...conv, messages: msgs } };
  });

  // 删除对话
  app.delete("/api/conversations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteConversation(id);
    return reply.status(204).send();
  });
}
