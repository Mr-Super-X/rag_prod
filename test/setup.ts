import { beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../src/db/index.js";

let app: FastifyInstance;

export function getApp(): FastifyInstance {
  return app;
}

beforeAll(async () => {
  // 重置测试数据库：清理 schema + drizzle 迁移记录，再由 migrate 重建全部表
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await migrate(db, { migrationsFolder: "./src/db/migrations" });

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  if (app) await app.close();
});
