import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`, 404, "NOT_FOUND");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export function errorHandler(
  error: FastifyError | AppError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: { code: error.code, message: error.message },
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.errors,
      },
    });
  }

  const fe = error as FastifyError;
  if (fe.statusCode && typeof fe.statusCode === "number") {
    return reply.status(fe.statusCode).send({
      success: false,
      error: { code: "FASTIFY_ERROR", message: fe.message },
    });
  }

  return reply.status(500).send({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
}
