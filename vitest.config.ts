import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL: "postgresql://raguser:ragpass@localhost:5432/ragtest",
      JWT_SECRET: "test-secret-do-not-use-in-production",
      OLLAMA_URL: "http://localhost:11434",
      QDRANT_URL: "http://localhost:6333",
      REDIS_URL: "redis://localhost:6379",
    },
  },
});
