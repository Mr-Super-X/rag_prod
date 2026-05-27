import type { FastifyInstance } from "fastify";
import { authenticate, requireKBAccess, authenticateApiKey } from "../middleware/auth.js";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { ask, streamAsk, buildContext, validateAndInjectCitations } from "../services/chat.service.js";
import { streamGenerate } from "../pipeline/generator.js";
import { addMessage } from "../services/context.service.js";
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
  app.addHook("onRequest", authenticateApiKey);
  app.addHook("onRequest", authenticate);

  // 问答（非流式，V1 兼容）
  app.post("/api/kb/:id/chat", { schema: { body: chatBody }, preHandler: [requireKBAccess] }, async (request, reply) => {
    const { id: kbId } = request.params as { id: string };
    const body = request.body as ChatRequest;

    const acceptSSE = request.headers.accept?.includes("text/event-stream");

    if (acceptSSE) {
      // 流式 SSE 响应
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      try {
        const result = await streamAsk(kbId, body.question, body.conversationId, request.user!.id);

        let fullAnswer = "";
        for await (const token of streamGenerate(
          buildContext(result.sources),
          result.rewrittenQuestion,
          result.historyForLLM as { role: "user" | "system" | "assistant"; content: string }[],
        )) {
          fullAnswer += token;
          reply.raw.write(`data: ${JSON.stringify({ token })}\n\n`);
        }

        const finalAnswer = validateAndInjectCitations(fullAnswer, result.sources);
        await addMessage(result.convId, "assistant", finalAnswer, result.sources);
        reply.raw.write(`data: ${JSON.stringify({ done: true, conversationId: result.convId, sources: result.sources, answer: finalAnswer })}\n\n`);
      } catch (err: unknown) {
        const e = err as { type?: string; message?: string; conversationId?: string };
        if (e.type === "agent") {
          reply.raw.write(`data: ${JSON.stringify({ done: true, agent: true, answer: e.message, conversationId: e.conversationId, sources: [] })}\n\n`);
        } else if (e.type === "fallback") {
          reply.raw.write(`data: ${JSON.stringify({ done: true, fallback: true, answer: e.message, conversationId: e.conversationId, sources: [] })}\n\n`);
        } else {
          reply.raw.write(`data: ${JSON.stringify({ error: e.message || "Stream failed" })}\n\n`);
        }
      }

      reply.raw.end();
      return;
    }

    // 非流式（V1 兼容）
    const result = await ask(kbId, body, request.user!.id);
    return { success: true, data: result };
  });

  // 对话列表（需 KB 访问权限）
  app.get("/api/kb/:id/conversations", { preHandler: [requireKBAccess] }, async (request) => {
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

  // 删除对话（仅自己的对话）
  app.delete("/api/conversations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await getConversation(id, request.user!.id); // 校验归属
    await deleteConversation(id);
    return reply.status(204).send();
  });

  // 导出对话为 Markdown
  app.get("/api/conversations/:id/export", async (request, reply) => {
    const { id } = request.params as { id: string };
    const conv = await getConversation(id, request.user!.id);
    const msgs = await getMessages(id);
    const lines = [`# ${conv.title || "对话"}\n`];
    for (const m of msgs) {
      const role = m.role === "user" ? "**用户**" : "**AI**";
      lines.push(`${role} (${new Date(m.createdAt).toLocaleString("zh-CN")})\n`);
      lines.push(`${m.content}\n`);
      if (m.sources && (m.sources as unknown[]).length > 0) {
        lines.push("> 引用来源：");
        for (const s of m.sources as { docFilename: string; content: string }[]) {
          lines.push(`> - ${s.docFilename}: ${s.content.slice(0, 100)}`);
        }
        lines.push("");
      }
    }
    reply.header("Content-Type", "text/markdown; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="conversation-${id.slice(0, 8)}.md"`);
    return lines.join("\n");
  });

  // 消息反馈（赞/踩）
  app.post("/api/messages/:id/feedback", async (request, reply) => {
    const { id: messageId } = request.params as { id: string };
    const { rating } = request.body as { rating: number };
    if (![1, -1].includes(rating)) {
      return reply.status(400).send({ success: false, error: { code: "INVALID_RATING", message: "Rating must be 1 or -1" } });
    }
    const userId = request.user!.id;

    const [existing] = await db
      .select()
      .from(schema.messageFeedback)
      .where(and(eq(schema.messageFeedback.messageId, messageId), eq(schema.messageFeedback.userId, userId)))
      .limit(1);

    if (existing) {
      if (existing.rating === rating) {
        await db.delete(schema.messageFeedback).where(eq(schema.messageFeedback.id, existing.id));
        return { success: true, data: { rating: null } };
      }
      await db
        .update(schema.messageFeedback)
        .set({ rating, updatedAt: new Date() })
        .where(eq(schema.messageFeedback.id, existing.id));
      return { success: true, data: { rating } };
    }

    await db.insert(schema.messageFeedback).values({ messageId, userId, rating });
    return reply.status(201).send({ success: true, data: { rating } });
  });
}
