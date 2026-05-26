import { searchVectors, type SearchResult } from "../lib/vectordb.js";
import { embedSingle } from "../pipeline/embedder.js";
import { redis } from "../lib/redis.js";
import { config } from "../config.js";
import type { ChunkSource } from "../types.js";

// 中文分词：尝试加载 jieba，失败则用字符级 bigram 降级
type CutFn = (text: string) => string[];

let cutFn: CutFn | null = null;

async function getCutFn(): Promise<CutFn> {
  if (cutFn) return cutFn;

  // 尝试加载 @node-rs/jieba
  try {
    const jiebaModule = await import("@node-rs/jieba");
    const JiebaClass = (jiebaModule as Record<string, unknown>).Jieba;
    if (JiebaClass && typeof JiebaClass === "function") {
      const jieba = new (JiebaClass as new () => { cut: (text: string) => string[]; loadDict: (buf: Uint8Array) => void })();
      jieba.loadDict(new Uint8Array(0)); // 内嵌默认词典
      cutFn = (text: string) => jieba.cut(text);
      return cutFn;
    }
  } catch {
    // jieba 不可用，降级到字符 bigram
  }

  // 字符 bigram 降级方案
  cutFn = (text: string) => {
    const tokens: string[] = [];
    const cleaned = text.replace(/[^一-龥a-zA-Z0-9]/g, " ");
    const words = cleaned.split(/\s+/).filter(Boolean);
    for (const word of words) {
      if (/^[一-龥]+$/.test(word)) {
        // 中文字符 bigram
        for (let i = 0; i < word.length; i++) {
          tokens.push(word[i]);
          if (i + 1 < word.length) {
            tokens.push(word[i] + word[i + 1]);
          }
        }
      } else {
        tokens.push(word.toLowerCase());
      }
    }
    return tokens;
  };
  return cutFn;
}

async function tokenize(text: string): Promise<string[]> {
  const cut = await getCutFn();
  return cut(text);
}

// BM25 在 Redis 中存储倒排索引
async function bm25Search(kbId: string, query: string, topK: number): Promise<{ chunkId: string; score: number }[]> {
  const terms = await tokenize(query);
  if (terms.length === 0) return [];

  const docScores = new Map<string, number>();

  for (const term of terms) {
    const key = `bm25:${kbId}:${term}`;
    try {
      const members = await redis.smembers(key);
      for (const member of members) {
        docScores.set(member, (docScores.get(member) || 0) + 1);
      }
    } catch {
      // Redis 错误不阻断检索
    }
  }

  return Array.from(docScores.entries())
    .map(([chunkId, score]) => ({ chunkId, score: score / terms.length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// 索引文档到 BM25 Redis 倒排
export async function indexBM25(kbId: string, chunkId: string, content: string): Promise<void> {
  const terms = await tokenize(content);
  if (terms.length === 0) return;

  const pipe = redis.pipeline();
  for (const term of terms) {
    pipe.sadd(`bm25:${kbId}:${term}`, chunkId);
  }
  try {
    await pipe.exec();
  } catch {
    // Redis 错误不阻断索引
  }
}

// RRF 融合
function rrfFuse(
  vectorResults: SearchResult[],
  bm25Results: { chunkId: string; score: number }[],
): Map<string, number> {
  const scores = new Map<string, number>();
  const k = config.RRF_K;

  vectorResults.forEach((r, rank) => {
    const id = String(r.id || r.payload.chunkId || "");
    if (id) {
      scores.set(id, (scores.get(id) || 0) + 1 / (k + rank + 1));
    }
  });

  bm25Results.forEach((r, rank) => {
    scores.set(r.chunkId, (scores.get(r.chunkId) || 0) + 1 / (k + rank + 1));
  });

  return scores;
}

export async function retrieve(kbId: string, question: string): Promise<ChunkSource[]> {
  const queryVector = await embedSingle(question);

  // 向量检索 (LanceDB)
  const vectorResults = await searchVectors(kbId, queryVector, config.RETRIEVAL_TOP_K);

  // BM25 检索
  const bm25Results = await bm25Search(kbId, question, config.RETRIEVAL_TOP_K);

  // RRF 融合
  const fused = rrfFuse(vectorResults, bm25Results);
  const sorted = Array.from(fused.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, config.FINAL_TOP_K);

  // 组装结果
  const sources: ChunkSource[] = [];
  for (const [chunkId, score] of sorted) {
    const match = vectorResults.find(
      (r) => String(r.id || r.payload.chunkId) === chunkId,
    );

    if (match) {
      sources.push({
        chunkId,
        content: String(match.payload.content || ""),
        score,
        docFilename: String(match.payload.docFilename || ""),
      });
    }
  }

  return sources;
}
