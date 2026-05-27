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
    refreshTokens: Symbol("refreshTokens"),
    knowledgeBases: Symbol("knowledgeBases"),
    kbMembers: Symbol("kbMembers"),
    documents: Symbol("documents"),
    chunks: Symbol("chunks"),
    conversations: Symbol("conversations"),
    messages: Symbol("messages"),
    apiKeys: Symbol("apiKeys"),
    auditLogs: Symbol("auditLogs"),
    messageFeedback: Symbol("messageFeedback"),
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2a$10$hashedpassword"),
    compare: vi.fn(),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val, type: "eq" })),
  and: vi.fn((...args: unknown[]) => ({ args, type: "and" })),
  gt: vi.fn((col: unknown, val: unknown) => ({ col, val, type: "gt" })),
  inArray: vi.fn(),
  desc: vi.fn(),
  isNull: vi.fn(),
}));

import bcrypt from "bcryptjs";
import { register, login, generateRefreshToken, refreshAccessToken, revokeRefreshTokens, seedAdmin } from "../../services/auth.service.js";
import { AppError } from "../../lib/errors.js";

describe("auth.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("register", () => {
    it("should throw on password < 8 chars", async () => {
      await expect(register("testuser", "ab1")).rejects.toThrow(AppError);
      await expect(register("testuser", "ab1")).rejects.toThrow("at least 8");
    });

    it("should throw on password without letters", async () => {
      await expect(register("testuser", "12345678")).rejects.toThrow(AppError);
      await expect(register("testuser", "12345678")).rejects.toThrow("letters and numbers");
    });

    it("should throw on password without numbers", async () => {
      await expect(register("testuser", "abcdefgh")).rejects.toThrow(AppError);
      await expect(register("testuser", "abcdefgh")).rejects.toThrow("letters and numbers");
    });

    it("should throw on duplicate username", async () => {
      const fromClause = { where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "1" }]) }) };
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue(fromClause) });

      await expect(register("existing", "pass1234")).rejects.toThrow("already exists");
    });

    it("should register successfully", async () => {
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "u1", username: "newuser", role: "user" }]),
        }),
      });

      const result = await register("newuser", "pass1234");
      expect(result).toEqual({ id: "u1", username: "newuser", role: "user" });
    });
  });

  describe("login", () => {
    it("should throw on non-existent user", async () => {
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });

      await expect(login("nobody", "pass1234")).rejects.toThrow("Invalid credentials");
    });

    it("should throw on wrong password", async () => {
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "u1", username: "user", passwordHash: "hashed", role: "user" }]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      await expect(login("user", "wrongpass")).rejects.toThrow("Invalid credentials");
    });

    it("should return user on valid credentials", async () => {
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "u1", username: "user", passwordHash: "hashed", role: "user" }]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const result = await login("user", "pass1234");
      expect(result).toEqual({ id: "u1", username: "user", role: "user" });
    });
  });

  describe("generateRefreshToken", () => {
    it("should generate 96-char hex token", async () => {
      mockDb.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
      const token = await generateRefreshToken("u1");
      expect(token).toHaveLength(96);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe("refreshAccessToken", () => {
    it("should throw on invalid/expired token", async () => {
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });

      await expect(refreshAccessToken("bad-token")).rejects.toThrow("Invalid or expired");
    });

    it("should rotate token and return user on success", async () => {
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "rt1", userId: "u1", token: "valid", expiresAt: new Date() }]) });
      const secondWhereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "u1", username: "test", role: "user" }]) });

      mockDb.select
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: whereFn }) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: secondWhereFn }) });

      mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

      const result = await refreshAccessToken("valid");
      expect(result).toEqual({ userId: "u1", username: "test", role: "user" });
    });
  });

  describe("revokeRefreshTokens", () => {
    it("should delete all tokens for user", async () => {
      mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      await expect(revokeRefreshTokens("u1")).resolves.toBeUndefined();
    });
  });

  describe("seedAdmin", () => {
    it("should skip if admin already exists", async () => {
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "a1", username: "admin" }]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });

      const result = await seedAdmin();
      expect(result).toEqual({ id: "a1", username: "admin" });
    });
  });
});
