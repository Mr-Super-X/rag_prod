import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock config for generator tests
vi.mock("../../config.js", () => ({
  config: {
    OLLAMA_URL: "http://localhost:11434",
    LLM_MODEL: "qwen2.5:7b",
    LLM_PROVIDER: "ollama",
    DEEPSEEK_API_KEY: "",
    DEEPSEEK_MODEL: "deepseek-chat",
  },
}));

import { generate, rewriteQuestion } from "../../pipeline/generator.js";

describe("generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generate", () => {
    it("should call Ollama chat API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { content: "这是生成回答" } }),
      });

      const result = await generate("参考文档内容", "问题是什么？");
      expect(result).toBe("这是生成回答");
      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain("/api/chat");
      const body = JSON.parse(call[1].body);
      expect(body.stream).toBe(false);
      expect(body.messages).toBeDefined();
    });

    it("should include context and question in message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { content: "OK" } }),
      });

      await generate("CONTEXT_HERE", "QUESTION_HERE");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMsg = body.messages[body.messages.length - 1].content;
      expect(userMsg).toContain("CONTEXT_HERE");
      expect(userMsg).toContain("QUESTION_HERE");
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(generate("ctx", "q")).rejects.toThrow("Ollama chat failed");
    });
  });

  describe("rewriteQuestion", () => {
    it("should return original if no history", async () => {
      const result = await rewriteQuestion("今天天气怎么样？", []);
      expect(result).toBe("今天天气怎么样？");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should call Ollama for context rewriting", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { content: " 改写后的问题 " } }),
      });

      const history = [{ role: "user", content: "苹果很好吃" }, { role: "assistant", content: "是的" }];
      const result = await rewriteQuestion("它有什么营养？", history);
      expect(result).toBe("改写后的问题");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should fallback to original on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await rewriteQuestion("问题", [{ role: "user", content: "历史" }]);
      expect(result).toBe("问题");
    });

    it("should fallback to original on empty response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { content: "   " } }),
      });

      const result = await rewriteQuestion("问题", [{ role: "user", content: "历史" }]);
      expect(result).toBe("问题");
    });
  });
});
