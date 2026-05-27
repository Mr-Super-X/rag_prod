import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../../db/index.js", () => ({
  db: mockDb,
  schema: {
    users: Symbol("users"),
    knowledgeBases: Symbol("knowledgeBases"),
    kbMembers: Symbol("kbMembers"),
    refreshTokens: Symbol("refreshTokens"),
    documents: Symbol("documents"),
    chunks: Symbol("chunks"),
    conversations: Symbol("conversations"),
    messages: Symbol("messages"),
    apiKeys: Symbol("apiKeys"),
    auditLogs: Symbol("auditLogs"),
    messageFeedback: Symbol("messageFeedback"),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val, type: "eq" })),
  and: vi.fn((...args: unknown[]) => ({ args, type: "and" })),
  gt: vi.fn(),
  inArray: vi.fn(),
  desc: vi.fn((col: unknown) => ({ col, type: "desc" })),
  isNull: vi.fn(),
}));

import {
  createConversation,
  getConversation,
  listConversations,
  deleteConversation,
  getMessages,
  addMessage,
  getRecentHistory,
  updateConversationTitle,
} from "../../services/context.service.js";
import { NotFoundError } from "../../lib/errors.js";

describe("context.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createConversation", () => {
    it("should create with default title", async () => {
      const conv = { id: "c1", kbId: "kb1", userId: "u1", title: "新对话" };
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([conv]),
        }),
      });

      const result = await createConversation("kb1", "u1");
      expect(result).toEqual(conv);
    });

    it("should create with custom title", async () => {
      const conv = { id: "c2", kbId: "kb1", userId: "u1", title: "自定义标题" };
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([conv]),
        }),
      });

      const result = await createConversation("kb1", "u1", "自定义标题");
      expect(result.title).toBe("自定义标题");
    });
  });

  describe("getConversation", () => {
    it("should return conversation when found", async () => {
      const conv = { id: "c1", kbId: "kb1", userId: "u1", title: "Test" };
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([conv]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });

      const result = await getConversation("c1", "u1");
      expect(result).toEqual(conv);
    });

    it("should throw NotFoundError when not found", async () => {
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });

      await expect(getConversation("bad-id", "u1")).rejects.toThrow(NotFoundError);
    });
  });

  describe("listConversations", () => {
    it("should return ordered by updatedAt desc", async () => {
      const convs = [{ id: "c2" }, { id: "c1" }];
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(convs),
          }),
        }),
      });

      const result = await listConversations("u1");
      expect(result).toEqual(convs);
    });
  });

  describe("deleteConversation", () => {
    it("should delete conversation", async () => {
      mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      await expect(deleteConversation("c1")).resolves.toBeUndefined();
    });
  });

  describe("getMessages", () => {
    it("should return messages ordered by createdAt", async () => {
      const msgs = [{ id: "m1", role: "user" }, { id: "m2", role: "assistant" }];
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(msgs),
          }),
        }),
      });

      const result = await getMessages("c1");
      expect(result).toEqual(msgs);
    });
  });

  describe("addMessage", () => {
    it("should insert message and update conversation timestamp", async () => {
      const msg = { id: "m1", conversationId: "c1", role: "user", content: "Hello", sources: null, createdAt: new Date() };
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([msg]),
        }),
      });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await addMessage("c1", "user", "Hello");
      expect(result.content).toBe("Hello");
      expect(result.role).toBe("user");
    });

    it("should include sources when provided", async () => {
      const sources = [{ chunkId: "c1", content: "source", score: 0.9, docFilename: "f.pdf" }];
      const msg = { id: "m2", conversationId: "c1", role: "assistant", content: "Answer", sources, createdAt: new Date() };
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([msg]),
        }),
      });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await addMessage("c1", "assistant", "Answer", sources);
      expect(result.sources).toEqual(sources);
    });
  });

  describe("getRecentHistory", () => {
    it("should return last N messages in chronological order", async () => {
      const msgs = [
        { id: "m3", role: "user", content: "C", sources: null, createdAt: new Date(3) },
        { id: "m4", role: "assistant", content: "D", sources: null, createdAt: new Date(4) },
      ];
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([...msgs].reverse()),
            }),
          }),
        }),
      });

      const result = await getRecentHistory("c1", 4);
      expect(result[0].content).toBe("C");
      expect(result[1].content).toBe("D");
    });
  });

  describe("updateConversationTitle", () => {
    it("should update title", async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await expect(updateConversationTitle("c1", "New Title")).resolves.toBeUndefined();
    });
  });
});
