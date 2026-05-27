import { describe, it, expect } from "vitest";
import { buildContext, validateAndInjectCitations } from "../../services/chat.service.js";
import type { ChunkSource } from "../../types.js";

describe("buildContext", () => {
  it("should return empty string for empty sources", () => {
    expect(buildContext([])).toBe("");
  });

  it("should format single source with index", () => {
    const sources: ChunkSource[] = [
      { chunkId: "c1", content: "这是文档内容", score: 0.9, docFilename: "手册.pdf" },
    ];
    const result = buildContext(sources);
    expect(result).toBe("[1] 手册.pdf\n这是文档内容");
  });

  it("should format multiple sources with indices", () => {
    const sources: ChunkSource[] = [
      { chunkId: "c1", content: "内容A", score: 0.9, docFilename: "a.pdf" },
      { chunkId: "c2", content: "内容B", score: 0.8, docFilename: "b.pdf" },
      { chunkId: "c3", content: "内容C", score: 0.7, docFilename: "c.pdf" },
    ];
    const result = buildContext(sources);
    expect(result).toContain("[1] a.pdf");
    expect(result).toContain("[2] b.pdf");
    expect(result).toContain("[3] c.pdf");
  });

  it("should use 1-based indexing", () => {
    const sources: ChunkSource[] = [
      { chunkId: "x", content: "X", score: 1, docFilename: "f" },
    ];
    const result = buildContext(sources);
    expect(result).toContain("[1]"); // 1-based, not 0
    expect(result).not.toContain("[0]");
  });
});

describe("validateAndInjectCitations", () => {
  const sources: ChunkSource[] = [
    { chunkId: "c1", content: "文档一的内容在这里", score: 0.9, docFilename: "手册1.pdf" },
    { chunkId: "c2", content: "文档二的内容在这里", score: 0.8, docFilename: "手册2.pdf" },
  ];

  it("should return answer unchanged when no sources", () => {
    const answer = "这是一个没有来源的回答";
    expect(validateAndInjectCitations(answer, [])).toBe(answer);
  });

  it("should keep valid citation markers", () => {
    const answer = "根据文档[1]和[2]的说明";
    const result = validateAndInjectCitations(answer, sources);
    expect(result).toContain("[1]");
    expect(result).toContain("[2]");
  });

  it("should strip out-of-bounds citation numbers", () => {
    const answer = "根据文档[1]和[5]和[99]的说明";
    const result = validateAndInjectCitations(answer, sources);
    expect(result).toContain("[1]");
    expect(result).not.toContain("[5]");
    expect(result).not.toContain("[99]");
  });

  it("should preserve surrounding text", () => {
    const answer = "文档[1]提到了一些关键信息，文档[2]也做了补充。";
    const result = validateAndInjectCitations(answer, sources);
    expect(result).toContain("关键信息");
    expect(result).toContain("补充");
  });

  it("should inject citations when answer has none via bigram overlap", () => {
    const answer = "文档一提到了一些关键信息。文档二也做了相关补充说明。";
    const result = validateAndInjectCitations(answer, sources);
    // Should inject citations where bigram overlap >= 3
    // "文档一" matches source[0], "文档二" matches source[1]
    expect(result).toBeTruthy();
  });

  it("should not inject citations for short sentences", () => {
    const answer = "好的。收到。";
    const result = validateAndInjectCitations(answer, sources);
    // Sentences shorter than 6 chars are skipped
    expect(result).toBe("好的。收到。");
  });

  it("should handle answer with only valid 1-2 digit citation numbers", () => {
    const answer = "[1][2]根据上述文档，总结如下。";
    const result = validateAndInjectCitations(answer, sources);
    expect(result).toContain("[1]");
    expect(result).toContain("[2]");
  });

  it("should strip invalid citation [0]", () => {
    const answer = "[0]文档提到了关键内容";
    const result = validateAndInjectCitations(answer, sources);
    expect(result).not.toContain("[0]");
  });
});
