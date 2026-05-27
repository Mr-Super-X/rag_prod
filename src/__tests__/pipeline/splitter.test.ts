import { describe, it, expect } from "vitest";
import { splitText, type TextChunk } from "../../pipeline/splitter.js";

describe("splitText", () => {
  it("should return empty array for empty input", () => {
    const result = splitText("");
    expect(result).toEqual([]);
  });

  it("should return empty array for whitespace-only input", () => {
    const result = splitText("   \n\n   ");
    expect(result).toEqual([]);
  });

  it("should create single chunk for short text", () => {
    const result = splitText("这是很短的文本。", { docId: "d1", kbId: "k1" });
    expect(result.length).toBe(1);
    expect(result[0].content).toBe("这是很短的文本。");
    expect(result[0].metadata).toEqual({ docId: "d1", kbId: "k1" });
    expect(result[0].index).toBe(0);
  });

  it("should generate SHA256 content hash", () => {
    const result = splitText("test content");
    expect(result[0].contentHash).toHaveLength(64);
    expect(result[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should split paragraphs at paragraph boundaries", () => {
    // 每个段落保证超过 CHUNK_SIZE=500，确保触发分块
    const longPara = "这是一段非常长的测试文本内容用来触发分块机制。".repeat(20);
    const paragraphs = Array.from({ length: 5 }, (_, i) => `${longPara}_第${i + 1}段`).join("\n\n");
    const result = splitText(paragraphs);
    // Should split into multiple chunks based on CHUNK_SIZE
    expect(result.length).toBeGreaterThan(1);
  });

  it("should assign sequential indices", () => {
    const longText = Array.from({ length: 50 }, (_, i) => `第${i + 1}段比较长的文本内容用来触发分块机制`).join("\n\n");
    const result = splitText(longText);
    for (let i = 0; i < result.length; i++) {
      expect(result[i].index).toBe(i);
    }
  });

  it("should maintain content integrity across chunks", () => {
    const text = "第一部分内容比较长需要测试分块\n\n第二部分内容也比较长需要测试分块\n\n第三部分内容继续测试分块机制";
    const result = splitText(text);
    // All content should be in chunks somewhere
    const combined = result.map((c) => c.content).join(" ");
    expect(combined).toContain("第一部分");
    expect(combined).toContain("第二部分");
    expect(combined).toContain("第三部分");
  });

  it("should skip empty paragraphs", () => {
    const text = "第一段有效内容\n\n  \n\n第二段有效内容";
    const result = splitText(text);
    expect(result.length).toBe(1); // Both paragraphs fit in one chunk
    expect(result[0].content).toContain("第一段有效内容");
    expect(result[0].content).toContain("第二段有效内容");
  });

  it("should handle single paragraph text", () => {
    const result = splitText("单段落文本", { filename: "test.md" });
    expect(result.length).toBe(1);
    expect(result[0].metadata).toEqual({ filename: "test.md" });
  });

  it("should produce unique hashes for different content", () => {
    const r1 = splitText("content A");
    const r2 = splitText("content B");
    expect(r1[0].contentHash).not.toBe(r2[0].contentHash);
  });

  it("should produce identical hashes for identical content", () => {
    const r1 = splitText("identical content");
    const r2 = splitText("identical content");
    expect(r1[0].contentHash).toBe(r2[0].contentHash);
  });
});
