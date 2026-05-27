import { config } from "../config.js";
import { retrieve } from "./retrieval.service.js";
import { generate, streamGenerate, rewriteQuestion } from "../pipeline/generator.js";
import { detectAndExecute } from "../pipeline/agent.js";
import {
  createConversation,
  getConversation,
  addMessage,
  getRecentHistory,
  updateConversationTitle,
} from "./context.service.js";
import type { ChatRequest, ChatResponse, ChunkSource } from "../types.js";

export async function ask(
  kbId: string,
  request: ChatRequest,
  userId: string,
): Promise<ChatResponse> {
  const { question, conversationId } = request;

  // 对话管理：获取或创建 session
  let convId = conversationId;
  if (!convId) {
    const conv = await createConversation(kbId, userId, question.slice(0, 50));
    convId = conv.id;
  } else {
    await getConversation(convId, userId);
  }

  // 上下文改写
  const history = await getRecentHistory(convId, 6);
  const historyForRewrite = history.map((m) => ({ role: m.role, content: m.content }));
  const rewrittenQuestion = await rewriteQuestion(question, historyForRewrite);

  // 保存用户消息
  await addMessage(convId, "user", question);

  // Agent: 检测函数调用
  const agentResult = await detectAndExecute(rewrittenQuestion);
  if (agentResult.isFunctionCall && agentResult.result) {
    const answer = `Agent 执行结果：${agentResult.result}`;
    await addMessage(convId, "assistant", answer, []);
    if (history.length <= 2) {
      const title = question.slice(0, 50) + (question.length > 50 ? "..." : "");
      await updateConversationTitle(convId, title);
    }
    return { answer, sources: [], conversationId: convId };
  }

  // 检索
  const sources = await retrieve(kbId, rewrittenQuestion);

  // 检索兜底：无结果时返回提示
  if (sources.length === 0) {
    const fallback = "抱歉，当前知识库中未找到与您问题相关的内容。建议换个关键词试试，或联系管理员扩充知识库。";
    await addMessage(convId, "assistant", fallback, []);
    return { answer: fallback, sources: [], conversationId: convId };
  }

  // 构建上下文
  const context = sources
    .map((s, i) => `[文档片段 ${i + 1}] (来源: ${s.docFilename})\n${s.content}`)
    .join("\n\n");

  // 生成
  const historyForLLM = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  const answer = await generate(context, rewrittenQuestion, historyForLLM);

  // 保存回答
  await addMessage(convId, "assistant", answer, sources);

  // 自动更新对话标题
  if (history.length <= 2) {
    const title = question.slice(0, 50) + (question.length > 50 ? "..." : "");
    await updateConversationTitle(convId, title);
  }

  return { answer, sources, conversationId: convId };
}

export async function streamAsk(
  kbId: string,
  question: string,
  conversationId: string | undefined,
  userId: string,
): Promise<{ convId: string; historyForLLM: { role: string; content: string }[]; rewrittenQuestion: string; sources: import("../types.js").ChunkSource[] }> {
  // 对话管理
  let convId = conversationId;
  if (!convId) {
    const conv = await createConversation(kbId, userId, question.slice(0, 50));
    convId = conv.id;
  } else {
    await getConversation(convId, userId);
  }

  // 上下文改写
  const history = await getRecentHistory(convId, 6);
  const historyForRewrite = history.map((m) => ({ role: m.role, content: m.content }));
  const rewrittenQuestion = await rewriteQuestion(question, historyForRewrite);

  // 保存用户消息
  await addMessage(convId, "user", question);

  // Agent: 检测函数调用
  const agentResult = await detectAndExecute(rewrittenQuestion);
  if (agentResult.isFunctionCall && agentResult.result) {
    await addMessage(convId, "assistant", agentResult.result, []);
    throw { type: "agent", message: agentResult.result, conversationId: convId };
  }

  // 检索
  const sources = await retrieve(kbId, rewrittenQuestion);

  // 检索兜底
  if (sources.length === 0) {
    const fallback = "抱歉，当前知识库中未找到与您问题相关的内容。建议换个关键词试试，或联系管理员扩充知识库。";
    await addMessage(convId, "assistant", fallback, []);
    throw { type: "fallback", message: fallback, conversationId: convId };
  }

  // 构建上下文
  const context = sources
    .map((s, i) => `[文档片段 ${i + 1}] (来源: ${s.docFilename})\n${s.content}`)
    .join("\n\n");

  const historyForLLM = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // 自动更新标题
  if (history.length <= 2) {
    const title = question.slice(0, 50) + (question.length > 50 ? "..." : "");
    await updateConversationTitle(convId, title);
  }

  return { convId, historyForLLM, rewrittenQuestion, sources };
}
