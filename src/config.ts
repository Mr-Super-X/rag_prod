import { z } from "zod";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch {
    // .env 不存在时忽略
  }
}

loadEnv();

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://raguser:ragpass@localhost:5432/ragdb"),
  OLLAMA_URL: z.string().default("http://localhost:11434"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(8).default("change-me-to-a-random-secret"),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  MAX_FILE_SIZE_MB: z.coerce.number().default(50),
  LLM_MODEL: z.string().default("qwen2.5:7b"),
  EMBEDDING_MODEL: z.string().default("bge-m3"),
  EMBEDDING_DIM: z.coerce.number().default(1024),
  CHUNK_SIZE: z.coerce.number().default(500),
  CHUNK_OVERLAP: z.coerce.number().default(50),
  RETRIEVAL_TOP_K: z.coerce.number().default(25),
  RRF_K: z.coerce.number().default(60),
  FINAL_TOP_K: z.coerce.number().default(10),
  RERANKER_TOP_K: z.coerce.number().default(25),
  RERANKER_ENABLED: z.coerce.boolean().default(false),
  SIMILARITY_THRESHOLD: z.coerce.number().default(0.5),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
