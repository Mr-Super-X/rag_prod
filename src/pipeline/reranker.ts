import { config } from "../config.js";
import type { ChunkSource } from "../types.js";

// Reranker：将候选文档和问题一起提交给 LLM，让它选出最相关的 Top-K
// 列表式（listwise）——一次 LLM 调用评分全部候选，而非逐条调用

export async function rerank(
  query: string,
  candidates: ChunkSource[],
): Promise<ChunkSource[]> {
  if (!config.RERANKER_ENABLED || candidates.length <= config.FINAL_TOP_K) {
    return candidates.slice(0, config.FINAL_TOP_K);
  }

  try {
    // 构建候选列表供 LLM 评分
    const candidateList = candidates
      .map((c, i) => `[${i + 1}] ${c.content.slice(0, 300)}`)
      .join("\n---\n");

    const prompt = `你是一个检索结果排序助手。根据用户问题，从以下文档片段中选出最相关的 ${config.FINAL_TOP_K} 个，按相关度从高到低排列。只返回编号，用逗号分隔，不要解释。

用户问题：${query}

文档片段：
${candidateList}

最相关的 ${config.FINAL_TOP_K} 个片段编号（逗号分隔，如：3,7,1,12,5）：`;

    const res = await fetch(`${config.OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.LLM_MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: { temperature: 0, num_predict: 50 },
      }),
    });

    if (!res.ok) throw new Error(`Rerank failed: ${res.status}`);

    const data = await res.json() as { message: { content: string } };
    const numbers = data.message.content.match(/\d+/g);
    if (!numbers) throw new Error("No valid response");

    // 按 LLM 返回的编号顺序重新排列
    const reranked: ChunkSource[] = [];
    const seen = new Set<number>();
    for (const n of numbers) {
      const idx = parseInt(n) - 1;
      if (idx >= 0 && idx < candidates.length && !seen.has(idx)) {
        reranked.push({ ...candidates[idx], score: 1 - reranked.length * 0.05 });
        seen.add(idx);
      }
    }

    return reranked.length > 0 ? reranked : candidates.slice(0, config.FINAL_TOP_K);
  } catch {
    return candidates.slice(0, config.FINAL_TOP_K);
  }
}
