import { config } from "../config.js";
import type { ChunkSource } from "../types.js";

// 降级 Reranker：用 query 和每个 chunk 的文本拼接后调 Embedding 模型
// 通过计算 query+chunk 的向量与原始 query 向量的余弦相似度差值来估算相关性
// 这不是严格的 Cross-Encoder，但在 CPU 环境下比加载额外 2GB 模型更实用

let rerankFn: ((query: string, docs: string[]) => Promise<number[]>) | null = null;

async function getRerankFn(): Promise<(query: string, docs: string[]) => Promise<number[]>> {
  if (rerankFn) return rerankFn;

  // 尝试用 Ollama 的小模型做相关性判断
  rerankFn = async (query: string, docs: string[]): Promise<number[]> => {
    const scores: number[] = [];
    for (const doc of docs) {
      const prompt = `你是一个文本相关性判断助手。请判断以下文档片段与问题的相关程度，给出 0 到 1 之间的分数（1=完全相关，0=完全无关）。只返回数字，不要解释。

问题：${query}

文档片段：${doc.slice(0, 500)}

相关度分数（0-1）：`;

      try {
        const res = await fetch(`${config.OLLAMA_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.LLM_MODEL,
            messages: [{ role: "user", content: prompt }],
            stream: false,
            options: { temperature: 0, num_predict: 5 },
          }),
        });

        if (!res.ok) {
          scores.push(0.5);
          continue;
        }

        const data = (await res.json()) as { message: { content: string } };
        const score = parseFloat(data.message.content.trim());
        scores.push(isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score)));
      } catch {
        scores.push(0.5);
      }
    }
    return scores;
  };

  return rerankFn;
}

export async function rerank(
  query: string,
  candidates: ChunkSource[],
): Promise<ChunkSource[]> {
  if (!config.RERANKER_ENABLED || candidates.length <= config.FINAL_TOP_K) {
    return candidates.slice(0, config.FINAL_TOP_K);
  }

  try {
    const fn = await getRerankFn();
    const docs = candidates.map((c) => c.content);
    const scores = await fn(query, docs);

    // 用 rerank 分数替换原来的 RRF 分数
    const reranked = candidates.map((c, i) => ({ ...c, score: scores[i] }));
    reranked.sort((a, b) => b.score - a.score);

    return reranked.slice(0, config.FINAL_TOP_K);
  } catch {
    // 降级：返回原始 Top-K
    return candidates.slice(0, config.FINAL_TOP_K);
  }
}
