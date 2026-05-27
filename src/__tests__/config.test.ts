import { describe, it, expect, beforeEach } from "vitest";

// config.ts 在 import 时就用 envSchema.parse 解析了 process.env
// 需要在 import 前设置环境变量，所以用 vi.resetModules + 动态 import

describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    delete process.env.LLM_PROVIDER;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.RERANKER_ENABLED;
  });

  it("should use default values when no env vars set", async () => {
    // 设置必填的最小值
    process.env.JWT_SECRET = "test-secret-min-length";
    const { config } = await import("../config.js");
    expect(config.DATABASE_URL).toBe("postgresql://raguser:ragpass@localhost:5432/ragdb");
    expect(config.OLLAMA_URL).toBe("http://localhost:11434");
    expect(config.REDIS_URL).toBe("redis://localhost:6379");
    expect(config.LLM_MODEL).toBe("qwen2.5:7b");
    expect(config.EMBEDDING_MODEL).toBe("bge-m3");
    expect(config.EMBEDDING_DIM).toBe(1024);
    expect(config.CHUNK_SIZE).toBe(500);
    expect(config.CHUNK_OVERLAP).toBe(50);
    expect(config.RETRIEVAL_TOP_K).toBe(25);
    expect(config.RRF_K).toBe(60);
    expect(config.FINAL_TOP_K).toBe(10);
    expect(config.LLM_PROVIDER).toBe("ollama");
    expect(config.AGENT_ENABLED).toBe(false);
    expect(config.RERANKER_ENABLED).toBe(false);
  });

  it("should accept valid LLM_PROVIDER values", async () => {
    process.env.JWT_SECRET = "test-secret-min-length";
    process.env.LLM_PROVIDER = "deepseek";
    const { config } = await import("../config.js");
    expect(config.LLM_PROVIDER).toBe("deepseek");
  });

  it("should coerce string booleans for feature flags", async () => {
    process.env.JWT_SECRET = "test-secret-min-length";
    process.env.RERANKER_ENABLED = "true";
    process.env.AGENT_ENABLED = "1";
    const { config } = await import("../config.js");
    expect(config.RERANKER_ENABLED).toBe(true);
    expect(config.AGENT_ENABLED).toBe(true);
  });

  it("should coerce number values from string env vars", async () => {
    process.env.JWT_SECRET = "test-secret-min-length";
    process.env.CHUNK_SIZE = "800";
    process.env.EMBEDDING_DIM = "768";
    const { config } = await import("../config.js");
    expect(config.CHUNK_SIZE).toBe(800);
    expect(config.EMBEDDING_DIM).toBe(768);
  });

  it("should require JWT_SECRET minimum 8 characters", async () => {
    process.env.JWT_SECRET = "short"; // < 8 chars
    await expect(import("../config.js")).rejects.toThrow();
  });

  it("should reject invalid LLM_PROVIDER value", async () => {
    process.env.JWT_SECRET = "test-secret-min-length";
    process.env.LLM_PROVIDER = "invalid-provider";
    await expect(import("../config.js")).rejects.toThrow();
  });

  it("should parse MAX_FILE_SIZE_MB as number", async () => {
    process.env.JWT_SECRET = "test-secret-min-length";
    process.env.MAX_FILE_SIZE_MB = "100";
    const { config } = await import("../config.js");
    expect(config.MAX_FILE_SIZE_MB).toBe(100);
  });
});
