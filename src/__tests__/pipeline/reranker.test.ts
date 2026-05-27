import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config.js", () => ({
  config: {
    OLLAMA_URL: "http://localhost:11434",
    LLM_MODEL: "qwen2.5:7b",
    RERANKER_ENABLED: true,
    FINAL_TOP_K: 3,
    RERANKER_TOP_K: 10,
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { rerank } from "../../pipeline/reranker.js";
import type { ChunkSource } from "../../types.js";

describe("reranker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const candidates: ChunkSource[] = [
    { chunkId: "c1", content: "苹果富含维生素C和纤维", score: 0.9, docFilename: "营养.pdf" },
    { chunkId: "c2", content: "香蕉含有丰富的钾元素", score: 0.8, docFilename: "营养.pdf" },
    { chunkId: "c3", content: "橙子是维生素C的良好来源", score: 0.7, docFilename: "水果.pdf" },
    { chunkId: "c4", content: "牛奶含有丰富的钙质", score: 0.6, docFilename: "食品.pdf" },
    { chunkId: "c5", content: "鸡蛋是优质蛋白质的来源", score: 0.5, docFilename: "食品.pdf" },
  ];

  it("should return top candidates when equal to FINAL_TOP_K", async () => {
    // 3 candidates = FINAL_TOP_K, should just slice
    const top3 = candidates.slice(0, 3);
    const result = await rerank("水果有什么营养？", top3);
    expect(result.length).toBe(3);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should call LLM and re-rank when more candidates than FINAL_TOP_K", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: { content: "3,1,5" } }),
    });

    const result = await rerank("水果有什么营养？", candidates);
    expect(result.length).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("should fallback to top-K on API error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await rerank("query", candidates);
    expect(result.length).toBe(3); // FINAL_TOP_K
  });

  it("should truncate content to 300 chars in prompt", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: { content: "1,2,3" } }),
    });

    const longContent: ChunkSource[] = [
      { chunkId: "c1", content: "A".repeat(500), score: 0.9, docFilename: "long.pdf" },
      { chunkId: "c2", content: "B".repeat(500), score: 0.8, docFilename: "long.pdf" },
      { chunkId: "c3", content: "C".repeat(500), score: 0.7, docFilename: "long.pdf" },
      { chunkId: "c4", content: "D".repeat(500), score: 0.6, docFilename: "long.pdf" },
    ];

    await rerank("query", longContent);
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const prompt = callBody.messages[0].content;
    expect(prompt).not.toContain("A".repeat(500));
  });
});
