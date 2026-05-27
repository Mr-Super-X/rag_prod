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

export function buildContext(sources: ChunkSource[]): string {
  return sources
    .map((s, i) => `[${i + 1}] ${s.docFilename}\n${s.content}`)
    .join("\n\n");
}

export function validateAndInjectCitations(answer: string, sources: ChunkSource[]): string {
  if (sources.length === 0) return answer;

  const citationRegex = /\[(\d{1,2})\]/g;
  const hasCitations = citationRegex.test(answer);
  citationRegex.lastIndex = 0;

  if (hasCitations) {
    // 验证并剥离无效引用
    return answer.replace(/\[(\d{1,2})\]/g, (_match, num) => {
      const n = parseInt(num, 10);
      return n >= 1 && n <= sources.length ? _match : "";
    });
  }

  // 兜底：bigram 重叠注入
  const sentences = answer.split(/(?<=[。！？\n])/);
  const result: string[] = [];
  for (const sentence of sentences) {
    result.push(sentence);
    if (sentence.trim().length < 6) continue;

    // 构建句子的 bigram 集合
    const sentenceBigrams = new Set<string>();
    for (let i = 0; i < sentence.length - 1; i++) {
      sentenceBigrams.add(sentence.substring(i, i + 2));
    }
    if (sentenceBigrams.size === 0) continue;

    let bestIdx = -1;
    let bestOverlap = 0;
    for (let i = 0; i < sources.length; i++) {
      const sourceText = sources[i].content.slice(0, 800);
      let overlap = 0;
      for (let j = 0; j < sourceText.length - 1; j++) {
        if (sentenceBigrams.has(sourceText.substring(j, j + 2))) overlap++;
      }
      if (overlap > bestOverlap && overlap >= 3) {
        bestOverlap = overlap;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      result.push(`[${bestIdx + 1}]`);
    }
  }
  return result.join("");
}

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
  const context = buildContext(sources);

  // 生成
  const historyForLLM = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  const rawAnswer = await generate(context, rewrittenQuestion, historyForLLM);

  // 引用后处理
  const answer = validateAndInjectCitations(rawAnswer, sources);

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
