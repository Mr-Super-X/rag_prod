import { describe, it, expect } from "vitest";
import { kbTableName, setVectorVersion } from "../../lib/vectordb.js";

describe("vectordb", () => {
  describe("kbTableName", () => {
    it("should convert UUID to valid table name", () => {
      const name = kbTableName("abc-123-def-456");
      expect(name).toBe("kb_abc_123_def_456");
    });

    it("should not double-underscore when no hyphens", () => {
      const name = kbTableName("abcdef");
      expect(name).toBe("kb_abcdef");
    });
  });

  describe("setVectorVersion", () => {
    it("should not throw", () => {
      expect(() => setVectorVersion("test-kb", "_v2")).not.toThrow();
    });

    it("should accept empty version", () => {
      expect(() => setVectorVersion("test-kb", "")).not.toThrow();
    });
  });
});
