import { beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../src/db/index.js";

let app: FastifyInstance;

export function getApp(): FastifyInstance {
  return app;
}

beforeAll(async () => {
  // 清理测试数据库（先删依赖表再删主表，按外键依赖逆序）
  await db.execute(sql`DROP TABLE IF EXISTS message_feedback CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS api_keys CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS audit_logs CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS messages CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS conversations CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS chunks CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS documents CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS kb_members CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS refresh_tokens CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS knowledge_bases CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS users CASCADE`);

  // 重建 schema（依赖 drizzle migration）
  // 如果 migration 未运行，手动建表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      description TEXT,
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      filename VARCHAR(500) NOT NULL,
      file_type VARCHAR(20) NOT NULL,
      file_size BIGINT,
      storage_path VARCHAR(500) NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'processing',
      chunk_count INT DEFAULT 0,
      uploaded_by UUID NOT NULL REFERENCES users(id),
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      qdrant_point_id VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      chunk_index INT NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      title VARCHAR(300),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      sources JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS kb_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(500) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS message_feedback (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action VARCHAR(50) NOT NULL,
      resource VARCHAR(50) NOT NULL,
      resource_id VARCHAR(100),
      ip VARCHAR(45),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key_hash VARCHAR(255) NOT NULL UNIQUE,
      key_prefix VARCHAR(10) NOT NULL,
      name VARCHAR(100) NOT NULL,
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      revoked_at TIMESTAMPTZ
    )
  `);

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  if (app) await app.close();
});
