import { config } from "../config.js";

interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatResponse {
  message: { role: string; content: string };
}

const SYSTEM_PROMPT = `你是一个基于知识库的问答助手。请严格根据以下提供的文档内容回答问题。

规则：
1. 只基于提供的文档内容回答，不要编造任何不在文档中的信息
2. 如果文档中没有相关信息，请明确说"根据现有文档，无法回答此问题"
3. 回答要简洁、准确，引用文档中的原文支持你的判断
4. 使用中文回答`;

export async function generate(
  context: string,
  question: string,
  history: OllamaChatMessage[] = [],
): Promise<string> {
  const messages: OllamaChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: `参考文档：\n${context}\n\n问题：${question}` },
  ];

  const res = await fetch(`${config.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.LLM_MODEL,
      messages,
      stream: false,
      options: { temperature: 0.3, num_predict: 1024 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama chat failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as OllamaChatResponse;
  return data.message.content;
}

export async function rewriteQuestion(
  question: string,
  historyMessages: { role: string; content: string }[],
): Promise<string> {
  if (historyMessages.length === 0) return question;

  const contextLines = historyMessages.slice(-6).map(
    (m, i) => `${m.role === "user" ? "用户" : "助手"}: ${m.content}`,
  ).join("\n");

  const prompt = `你是一个对话改写助手。基于对话历史，将用户的问题改写为完整的独立问句，补全省略和指代。

对话历史：
${contextLines}

用户当前问题：${question}

改写后的问题（只返回改写结果，不要加任何解释）：`;

  const res = await fetch(`${config.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      options: { temperature: 0.1, num_predict: 100 },
    }),
  });

  if (!res.ok) return question; // 降级：失败则返回原始问题

  const data = (await res.json()) as OllamaChatResponse;
  const rewritten = data.message.content.trim();
  return rewritten || question;
}
