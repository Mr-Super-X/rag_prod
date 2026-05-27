import { describe, it, expect } from "vitest";
import { AppError, NotFoundError, UnauthorizedError, ForbiddenError, errorHandler } from "../../lib/errors.js";
import { ZodError, z } from "zod";

describe("AppError", () => {
  it("should create with default statusCode 500", () => {
    const err = new AppError("Something broke");
    expect(err.message).toBe("Something broke");
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.name).toBe("AppError");
  });

  it("should create with custom statusCode and code", () => {
    const err = new AppError("Bad request", 400, "BAD_DATA");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_DATA");
  });

  it("should be instance of Error", () => {
    const err = new AppError("test");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("NotFoundError", () => {
  it("should format resource and id", () => {
    const err = new NotFoundError("User", "abc-123");
    expect(err.message).toBe("User abc-123 not found");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });
});

describe("UnauthorizedError", () => {
  it("should use default message", () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe("Unauthorized");
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("should use custom message", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
    expect(err.statusCode).toBe(401);
  });
});

describe("ForbiddenError", () => {
  it("should use default message", () => {
    const err = new ForbiddenError();
    expect(err.message).toBe("Forbidden");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("should use custom message", () => {
    const err = new ForbiddenError("No access to KB");
    expect(err.message).toBe("No access to KB");
  });
});

describe("errorHandler", () => {
  function mockReply() {
    const sent: { status?: number; body?: unknown } = {};
    const reply = {
      status: (code: number) => {
        sent.status = code;
        return { send: (body: unknown) => { sent.body = body; return reply; } };
      },
    };
    return { reply, sent };
  }

  it("should handle AppError", () => {
    const { reply, sent } = mockReply();
    const err = new AppError("Bad gateway", 502, "UPSTREAM_FAIL");
    errorHandler(err, {} as never, reply as never);
    expect(sent.status).toBe(502);
    expect(sent.body).toEqual({
      success: false,
      error: { code: "UPSTREAM_FAIL", message: "Bad gateway" },
    });
  });

  it("should handle NotFoundError", () => {
    const { reply, sent } = mockReply();
    const err = new NotFoundError("Document", "doc-1");
    errorHandler(err, {} as never, reply as never);
    expect(sent.status).toBe(404);
    expect((sent.body as Record<string, unknown>).success).toBe(false);
  });

  it("should handle ZodError", () => {
    const { reply, sent } = mockReply();
    const zodErr = new ZodError([
      { code: "invalid_type", expected: "string", received: "number", path: ["name"], message: "Expected string" },
    ]);
    errorHandler(zodErr, {} as never, reply as never);
    expect(sent.status).toBe(400);
    expect((sent.body as Record<string, unknown>).success).toBe(false);
    expect((sent.body as Record<string, unknown>).error).toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("should handle Fastify error with statusCode", () => {
    const { reply, sent } = mockReply();
    const fastifyErr = { statusCode: 413, message: "Payload too large", name: "FastifyError" };
    errorHandler(fastifyErr as never, {} as never, reply as never);
    expect(sent.status).toBe(413);
  });

  it("should fallback to 500 for unknown errors", () => {
    const { reply, sent } = mockReply();
    const generic = new Error("Something weird");
    errorHandler(generic as never, {} as never, reply as never);
    expect(sent.status).toBe(500);
    expect((sent.body as Record<string, unknown>).error).toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });
});
