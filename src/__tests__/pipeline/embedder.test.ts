import { describe, it, expect, vi, beforeEach } from "vitest";

// 全局 mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { embed, embedSingle } from "../../pipeline/embedder.js";

describe("embedder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("embedSingle", () => {
    it("should embed single text and return vector", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ embeddings: [[0.1, 0.2, 0.3]] }),
      });

      const result = await embedSingle("测试文本");
      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should call Ollama embed API with correct payload", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ embeddings: [[0.5]] }),
      });

      await embedSingle("hello");
      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain("/api/embed");
      const body = JSON.parse(call[1].body);
      expect(body.input).toEqual(["hello"]);
      expect(body.model).toBeDefined();
    });
  });

  describe("embed", () => {
    it("should embed multiple texts in batches", async () => {
      const embeddings = Array.from({ length: 3 }, (_, i) => [i * 0.1, i * 0.2]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ embeddings }),
      });

      const result = await embed(["a", "b", "c"]);
      expect(result.length).toBe(3);
      expect(result[0].length).toBe(2);
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server error"),
      });

      await expect(embed(["text"])).rejects.toThrow("Ollama embed failed");
    });

    it("should batch large inputs (batch size 5)", async () => {
      const texts = Array.from({ length: 12 }, (_, i) => `text ${i}`);
      // 12 texts → 3 batches: 5+5+2
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ embeddings: Array.from({ length: 5 }, () => [0.1]) }),
      });

      const result = await embed(texts);
      // 3 batches × 5 = 15, but 12 expected. We get 5 from each mock call
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
