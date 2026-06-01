import { config } from "../config.js";

interface OllamaEmbedResponse {
  embeddings: number[][];
}

export async function embed(texts: string[], modelName?: string): Promise<number[][]> {
  const model = modelName ?? config.EMBEDDING_MODEL;
  // 大批量分小批，避免超时
  const batchSize = 5;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 分钟超时

    const res = await fetch(`${config.OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: batch }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Ollama embed failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as OllamaEmbedResponse;
    allEmbeddings.push(...data.embeddings);
  }

  return allEmbeddings;
}

export async function embedSingle(text: string, modelName?: string): Promise<number[]> {
  const results = await embed([text], modelName);
  return results[0];
}
