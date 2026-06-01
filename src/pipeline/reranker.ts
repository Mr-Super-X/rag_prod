import { config } from "../config.js";
import type { ChunkSource } from "../types.js";

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

export async function rerank(
  query: string,
  candidates: ChunkSource[],
): Promise<ChunkSource[]> {
  if (!config.RERANKER_ENABLED || candidates.length <= config.FINAL_TOP_K) {
    return candidates.slice(0, config.FINAL_TOP_K);
  }

  // CPU Ollama 下 similarityRerank（embed 批量调用）延迟不可控，直接走 LLM listwise
  try {
    return await llmListwiseRerank(query, candidates);
  } catch {
    return candidates.slice(0, config.FINAL_TOP_K);
  }
}

async function similarityRerank(query: string, candidates: ChunkSource[]): Promise<ChunkSource[]> {
  // 最多 8 条（1 query + 7 docs），避免 Ollama embed 过载+超时
  const input = candidates.slice(0, 7).map((c) => c.content.slice(0, 200));
  const texts = [query, ...input];
  const res = await fetchWithTimeout(`${config.OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.EMBEDDING_MODEL, input: texts }),
  }, 15000);

  if (!res.ok) throw new Error(`Embed rerank failed: ${res.status}`);
  const data = (await res.json()) as { embeddings: number[][] };
  const queryVec = data.embeddings[0];

  const scored = candidates.slice(0, input.length).map((c, i) => {
    const docVec = data.embeddings[i + 1];
    if (!docVec) return { candidate: c, score: 0 };
    const dot = docVec.reduce((sum, v, j) => sum + v * queryVec[j], 0);
    const qNorm = Math.sqrt(queryVec.reduce((s, v) => s + v * v, 0));
    const dNorm = Math.sqrt(docVec.reduce((s, v) => s + v * v, 0));
    const score = qNorm > 0 && dNorm > 0 ? dot / (qNorm * dNorm) : 0;
    return { candidate: c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, config.FINAL_TOP_K).map((s) => ({
    ...s.candidate,
    score: s.score,
  }));
}

async function llmListwiseRerank(query: string, candidates: ChunkSource[]): Promise<ChunkSource[]> {
  const candidateList = candidates
    .map((c, i) => `[${i + 1}] ${c.content.slice(0, 300)}`)
    .join("\n---\n");

  const prompt = `选出最相关的 ${config.FINAL_TOP_K} 个片段编号，逗号分隔：
${query}

${candidateList}

编号：`;

  const res = await fetchWithTimeout(`${config.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      options: { temperature: 0, num_predict: 50 },
    }),
  }, 30000);

  if (!res.ok) throw new Error(`LLM rerank failed: ${res.status}`);

  const data = await res.json() as { message: { content: string } };
  const numbers = data.message.content.match(/\d+/g);
  if (!numbers) throw new Error("No valid response");

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
}
