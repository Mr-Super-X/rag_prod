import { config } from "../config.js";

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

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
4. 在回答中使用 [1] [2] 标注引用了哪个参考文档片段
5. 使用中文回答`;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function buildMessages(context: string, question: string, history: ChatMessage[]): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: `参考文档：\n${context}\n\n问题：${question}` },
  ];
}

// DeepSeek API
async function deepseekChat(messages: ChatMessage[]): Promise<string> {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: config.DEEPSEEK_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 1024,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek error: ${res.status}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content;
}

async function* deepseekStream(messages: ChatMessage[]): AsyncGenerator<string> {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: config.DEEPSEEK_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 1024,
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek stream error: ${res.status}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const content = json.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch { /* skip */ }
    }
  }
}

// Ollama API (unchanged logic, extracted)
async function ollamaChat(messages: ChatMessage[]): Promise<string> {
  const res = await fetchWithTimeout(`${config.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.LLM_MODEL, messages, stream: false, options: { temperature: 0.3, num_predict: 1024 } }),
  }, 180000);
  if (!res.ok) throw new Error(`Ollama chat failed: ${res.status}`);
  const data = await res.json() as { message: { content: string } };
  return data.message.content;
}

async function* ollamaStream(messages: ChatMessage[]): AsyncGenerator<string> {
  const res = await fetchWithTimeout(`${config.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.LLM_MODEL, messages, stream: true, options: { temperature: 0.3, num_predict: 1024 } }),
  }, 180000);
  if (!res.ok) throw new Error(`Ollama stream failed: ${res.status}`);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try { const json = JSON.parse(line); if (json.message?.content) yield json.message.content; } catch { /* skip */ }
    }
  }
}

// 工厂：根据 LLM_PROVIDER 选择实现
export async function generate(context: string, question: string, history: ChatMessage[] = []): Promise<string> {
  const msgs = buildMessages(context, question, history);
  if (config.LLM_PROVIDER === "deepseek" && config.DEEPSEEK_API_KEY) {
    try { return await deepseekChat(msgs); } catch { /* 降级 */ }
  }
  return ollamaChat(msgs);
}

export async function* streamGenerate(context: string, question: string, history: ChatMessage[] = []): AsyncGenerator<string> {
  const msgs = buildMessages(context, question, history);
  if (config.LLM_PROVIDER === "deepseek" && config.DEEPSEEK_API_KEY) {
    try {
      for await (const t of deepseekStream(msgs)) { yield t; }
      return;
    } catch { /* 降级到本地 */ }
  }
  for await (const t of ollamaStream(msgs)) { yield t; }
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

  const res = await fetchWithTimeout(`${config.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      options: { temperature: 0.1, num_predict: 100 },
    }),
  }, 60000);

  if (!res.ok) return question; // 降级：失败则返回原始问题

  const data = (await res.json()) as OllamaChatResponse;
  const rewritten = data.message.content.trim();
  return rewritten || question;
}
