import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config.js", () => ({
  config: {
    OLLAMA_URL: "http://localhost:11434",
    LLM_MODEL: "qwen2.5:7b",
    AGENT_ENABLED: true,
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { detectAndExecute } from "../../pipeline/agent.js";

describe("agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectAndExecute", () => {
    it("should return false when API call fails", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const result = await detectAndExecute("今天几号？");
      expect(result.isFunctionCall).toBe(false);
      expect(result.result).toBeNull();
    });

    it("should return false for skip response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { content: '{"action":"skip"}' } }),
      });

      const result = await detectAndExecute("文档里写了什么？");
      expect(result.isFunctionCall).toBe(false);
      expect(result.result).toBeNull();
    });

    it("should return false for invalid JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { content: "not json" } }),
      });

      const result = await detectAndExecute("anything");
      expect(result.isFunctionCall).toBe(false);
    });

    it("should execute get_current_time function", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { content: '{"action":"call","function":"get_current_time","args":{}}' } }),
      });

      const result = await detectAndExecute("现在几点了？");
      expect(result.isFunctionCall).toBe(true);
      expect(result.result).toBeTruthy();
      expect(result.result).toContain("202"); // year starts with 202x
    });

    it("should execute simple_calculator with expression", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { content: '{"action":"call","function":"simple_calculator","args":{"expression":"2+3"}}' } }),
      });

      const result = await detectAndExecute("2加3等于几？");
      expect(result.isFunctionCall).toBe(true);
      expect(result.result).toBe("5");
    });

    it("should handle unknown function gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { content: '{"action":"call","function":"unknown_fn","args":{}}' } }),
      });

      const result = await detectAndExecute("do something");
      expect(result.isFunctionCall).toBe(false);
    });

    it("should sanitize calculator expression for safety", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { content: '{"action":"call","function":"simple_calculator","args":{"expression":"2+3"}}' } }),
      });

      // Expression sanitization: non-math chars removed
      const result = await detectAndExecute("算一下");
      expect(result.isFunctionCall).toBe(true);
      expect(result.result).toBe("5");
    });
  });
});
