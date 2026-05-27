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
    users: { id: Symbol("id"), username: Symbol("username"), role: Symbol("role") },
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
  desc: vi.fn(),
  isNull: vi.fn((col: unknown) => ({ col, type: "isNull" })),
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    createHmac: () => ({
      update: () => ({
        digest: () => "mocked-key-hash-12345",
      }),
    }),
  };
});

import { authenticate, requireAdmin, requireKBAccess, authenticateApiKey } from "../../middleware/auth.js";

describe("auth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authenticate", () => {
    it("should return 401 when JWT verification fails", async () => {
      const request = {
        jwtVerify: vi.fn().mockRejectedValue(new Error("jwt error")),
      } as unknown as Parameters<typeof authenticate>[0];
      const reply = {
        status: vi.fn().mockReturnValue({ send: vi.fn() }),
      } as unknown as Parameters<typeof authenticate>[1];

      await authenticate(request, reply);
      expect(reply.status).toHaveBeenCalledWith(401);
    });

    it("should continue when JWT is valid", async () => {
      const request = {
        jwtVerify: vi.fn().mockResolvedValue(undefined),
      } as unknown as Parameters<typeof authenticate>[0];
      const reply = {} as Parameters<typeof authenticate>[1];

      await authenticate(request, reply);
      expect(request.jwtVerify).toHaveBeenCalled();
    });
  });

  describe("requireAdmin", () => {
    it("should return 403 for non-admin user", async () => {
      const request = {
        user: { role: "user" },
      } as Parameters<typeof requireAdmin>[0];
      const reply = {
        status: vi.fn().mockReturnValue({ send: vi.fn() }),
      } as unknown as Parameters<typeof requireAdmin>[1];

      await requireAdmin(request, reply);
      expect(reply.status).toHaveBeenCalledWith(403);
    });

    it("should pass for admin user", async () => {
      const request = {
        user: { role: "admin" },
      } as Parameters<typeof requireAdmin>[0];
      const reply = {} as Parameters<typeof requireAdmin>[1];

      await requireAdmin(request, reply);
    });
  });

  describe("requireKBAccess", () => {
    it("should return 404 if KB not found", async () => {
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });

      const request = {
        params: { id: "kb-missing" },
        user: { id: "u1" },
      } as unknown as Parameters<typeof requireKBAccess>[0];
      const reply = {
        status: vi.fn().mockReturnValue({ send: vi.fn() }),
      } as unknown as Parameters<typeof requireKBAccess>[1];

      await requireKBAccess(request, reply);
      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it("should pass if user is KB creator", async () => {
      const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "kb1", createdBy: "u1" }]) });
      mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });

      const request = {
        params: { id: "kb1" },
        user: { id: "u1" },
      } as unknown as Parameters<typeof requireKBAccess>[0];
      const reply = {} as Parameters<typeof requireKBAccess>[1];

      await requireKBAccess(request, reply);
    });

    it("should return 403 if user is not a member", async () => {
      const whereFn1 = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "kb1", createdBy: "other" }]) });
      const whereFn2 = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
      mockDb.select
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: whereFn1 }) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: whereFn2 }) });

      const request = {
        params: { id: "kb1" },
        user: { id: "u1" },
      } as unknown as Parameters<typeof requireKBAccess>[0];
      const reply = {
        status: vi.fn().mockReturnValue({ send: vi.fn() }),
      } as unknown as Parameters<typeof requireKBAccess>[1];

      await requireKBAccess(request, reply);
      expect(reply.status).toHaveBeenCalledWith(403);
    });
  });

  describe("authenticateApiKey", () => {
    it("should skip if no Authorization header", async () => {
      const request = { headers: {} } as Parameters<typeof authenticateApiKey>[0];
      const reply = {} as Parameters<typeof authenticateApiKey>[1];

      await authenticateApiKey(request, reply);
      expect((request as Record<string, unknown>).user).toBeUndefined();
    });

    it("should skip if not Bearer token", async () => {
      const request = { headers: { authorization: "Basic xxx" } } as Parameters<typeof authenticateApiKey>[0];
      const reply = {} as Parameters<typeof authenticateApiKey>[1];

      await authenticateApiKey(request, reply);
      expect((request as Record<string, unknown>).user).toBeUndefined();
    });

    it("should not authenticate if key doesn't start with ak_", async () => {
      const request = { headers: { authorization: "Bearer not-api-key-format" } } as Parameters<typeof authenticateApiKey>[0];
      const reply = {} as Parameters<typeof authenticateApiKey>[1];

      await authenticateApiKey(request, reply);
      expect((request as Record<string, unknown>).user).toBeUndefined();
    });
  });
});
