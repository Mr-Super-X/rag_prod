import { redis } from "./redis.js";
import { createHash } from "node:crypto";
import type { ChunkSource } from "../types.js";

interface CachedAnswer {
  answer: string;
  sources: ChunkSource[];
  timestamp: number;
}

const TTL = 86400; // 24 小时

function cacheKey(kbId: string, question: string, model: string): string {
  const q = question.trim().toLowerCase().replace(/\s+/g, " ");
  const hash = createHash("sha256").update(q).digest("hex").slice(0, 16);
  return `cache:${kbId}:${model}:${hash}`;
}

export async function getCachedAnswer(kbId: string, question: string, model: string): Promise<CachedAnswer | null> {
  try {
    const key = cacheKey(kbId, question, model);
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedAnswer;
  } catch {
    return null;
  }
}

export async function setCachedAnswer(kbId: string, question: string, model: string, answer: string, sources: ChunkSource[]): Promise<void> {
  try {
    const key = cacheKey(kbId, question, model);
    const data: CachedAnswer = { answer, sources, timestamp: Date.now() };
    await redis.setex(key, TTL, JSON.stringify(data));
  } catch {
    // 缓存失败不影响主流程
  }
}

export async function invalidateKB(kbId: string): Promise<void> {
  try {
    const keys = await redis.keys(`cache:${kbId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // 清理失败不阻塞
  }
}

// 缓存统计
let cacheHits = 0;
let cacheMisses = 0;

export function recordHit() { cacheHits++; }
export function recordMiss() { cacheMisses++; }

export function getCacheStats() {
  const total = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    total,
    hitRate: total > 0 ? ((cacheHits / total) * 100).toFixed(1) : "0",
  };
}
