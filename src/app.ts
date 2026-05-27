import Fastify from "fastify";
import fjwt from "@fastify/jwt";
import fcors from "@fastify/cors";
import fmultipart from "@fastify/multipart";
import fratlimit from "@fastify/rate-limit";
import fswagger from "@fastify/swagger";
import fswaggerUi from "@fastify/swagger-ui";
import { config } from "./config.js";
import { errorHandler } from "./lib/errors.js";
import { authRoutes } from "./routes/auth.js";
import { kbRoutes } from "./routes/kb.js";
import { docRoutes } from "./routes/doc.js";
import { chatRoutes } from "./routes/chat.js";
import { redis } from "./lib/redis.js";
import { loggerConfig } from "./lib/logger.js";

export async function buildApp() {
  const app = Fastify({ logger: loggerConfig });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Plugins
  await app.register(fcors, { origin: true });
  await app.register(fjwt, { secret: config.JWT_SECRET });
  await app.register(fmultipart, { limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 } });
  await app.register(fratlimit, { max: 60, timeWindow: "1 minute" });
  await app.register(fswagger, {
    openapi: {
      info: { title: "RAG Enterprise API", version: "0.1.0" },
    },
  });
  await app.register(fswaggerUi, { routePrefix: "/docs" });

  // Routes
  await app.register(authRoutes);
  await app.register(kbRoutes);
  await app.register(docRoutes);
  await app.register(chatRoutes);

  // Health check
  app.get("/api/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // Connect Redis
  try {
    await redis.connect();
    app.log.info("Redis connected");
  } catch (err) {
    app.log.warn("Redis connection failed — some features may be degraded");
  }

  return app;
}
