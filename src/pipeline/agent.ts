import { config } from "../config.js";

interface FunctionDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<string>;
}

const functions: FunctionDef[] = [
  {
    name: "get_current_time",
    description: "获取当前日期和时间",
    parameters: {},
    handler: async () => new Date().toLocaleString("zh-CN"),
  },
  {
    name: "simple_calculator",
    description: "执行简单数学计算",
    parameters: {
      expression: { type: "string", description: "数学表达式，如 1+2*3" },
    },
    handler: async (args) => {
      try {
        const expr = String(args.expression).replace(/[^0-9+\-*/().%\s]/g, "");
        const result = Function(`"use strict"; return (${expr})`)();
        return String(result);
      } catch {
        return "计算失败：表达式无效";
      }
    },
  },
];

function buildFunctionsPrompt(): string {
  return functions.map((f) => {
    const params = Object.entries(f.parameters)
      .map(([k, v]) => `  - ${k}: ${(v as { description: string }).description}`)
      .join("\n");
    return `### ${f.name}\n${f.description}\n参数：\n${params || "  无"}`;
  }).join("\n\n");
}

export async function detectAndExecute(question: string): Promise<{
  isFunctionCall: boolean;
  result: string | null;
}> {
  if (!config.AGENT_ENABLED) return { isFunctionCall: false, result: null };

  const prompt = `你是一个意图分析助手。判断用户的问题是否需要调用以下函数。

可用函数：
${buildFunctionsPrompt()}

规则：
- 如果用户问题**与函数无关**（如问文档内容、闲聊），返回 {"action":"skip"}
- 如果用户问题**需要调用函数**，返回 {"action":"call","function":"函数名","args":{参数}}
- 只返回 JSON，不要加解释

用户问题：${question}`;

  const res = await fetch(`${config.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      options: { temperature: 0, num_predict: 200 },
    }),
  });

  if (!res.ok) return { isFunctionCall: false, result: null };

  const data = await res.json() as { message: { content: string } };
  try {
    const json = JSON.parse(data.message.content.trim());
    if (json.action !== "call" || !json.function) {
      return { isFunctionCall: false, result: null };
    }

    const fn = functions.find((f) => f.name === json.function);
    if (!fn) return { isFunctionCall: false, result: null };

    const result = await fn.handler(json.args || {});
    return { isFunctionCall: true, result };
  } catch {
    return { isFunctionCall: false, result: null };
  }
}
