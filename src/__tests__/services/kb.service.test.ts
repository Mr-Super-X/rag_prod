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

vi.mock("../../lib/vectordb.js", () => ({
  dropTable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val, type: "eq" })),
  and: vi.fn((...args: unknown[]) => ({ args, type: "and" })),
  gt: vi.fn(),
  inArray: vi.fn((col: unknown, vals: unknown[]) => ({ col, vals, type: "inArray" })),
  desc: vi.fn(),
  isNull: vi.fn(),
}));

import { listKBs, createKB, getKB, updateKB, deleteKB } from "../../services/kb.service.js";
import { NotFoundError, ForbiddenError } from "../../lib/errors.js";
import { dropTable } from "../../lib/vectordb.js";

describe("kb.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createKB", () => {
    it("should create KB and add creator as owner", async () => {
      const expectedKB = { id: "kb1", name: "测试库", description: "desc", createdBy: "u1" };
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([expectedKB]),
        }),
      });
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const result = await createKB({ name: "测试库", description: "desc" }, "u1");
      expect(result).toEqual(expectedKB);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it("should create KB without description", async () => {
      const expectedKB = { id: "kb2", name: "OnlyName", description: null, createdBy: "u1" };
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([expectedKB]),
        }),
      });
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const result = await createKB({ name: "OnlyName" }, "u1");
      expect(result).toEqual(expectedKB);
    });
  });

  describe("getKB", () => {
    it("should return KB when found", async () => {
      const kb = { id: "kb1", name: "Test", description: null, createdBy: "u1" };
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([kb]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });

      const result = await getKB("kb1");
      expect(result).toEqual(kb);
    });

    it("should throw NotFoundError when not found", async () => {
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });

      await expect(getKB("nonexistent")).rejects.toThrow(NotFoundError);
    });
  });

  describe("listKBs", () => {
    it("should return owned KBs only when no memberships", async () => {
      const owned = [{ id: "kb1", name: "My KB", createdBy: "u1" }];
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(owned),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await listKBs("u1");
      expect(result).toEqual(owned);
    });
  });

  describe("updateKB", () => {
    it("should update KB when user is owner", async () => {
      const kb = { id: "kb1", name: "Old", description: null, createdBy: "u1" };
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([kb]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });

      const updated = { ...kb, name: "New Name" };
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const result = await updateKB("kb1", { name: "New Name" }, "u1");
      expect(result!.name).toBe("New Name");
    });

    it("should throw ForbiddenError when not owner", async () => {
      const kb = { id: "kb1", name: "Old", description: null, createdBy: "other_user" };
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([kb]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });

      await expect(updateKB("kb1", { name: "New" }, "u1")).rejects.toThrow(ForbiddenError);
    });
  });

  describe("deleteKB", () => {
    it("should delete when user is owner", async () => {
      const kb = { id: "kb1", name: "Test", createdBy: "u1" };
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([kb]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });
      mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

      await expect(deleteKB("kb1", "u1", "user")).resolves.toBeUndefined();
      expect(dropTable).toHaveBeenCalledWith("kb1");
    });

    it("should allow admin to delete any KB", async () => {
      const kb = { id: "kb2", name: "Other", createdBy: "other" };
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([kb]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });
      mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

      await expect(deleteKB("kb2", "admin_user", "admin")).resolves.toBeUndefined();
    });

    it("should throw ForbiddenError when not owner and not admin", async () => {
      const kb = { id: "kb3", name: "Other", createdBy: "other" };
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([kb]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });

      await expect(deleteKB("kb3", "u1", "user")).rejects.toThrow(ForbiddenError);
    });
  });
});
