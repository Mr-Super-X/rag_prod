import { db, schema } from "../db/index.js";
import { eq, count } from "drizzle-orm";
import { embedSingle, embed } from "../pipeline/embedder.js";
import { insertVectors, dropTable, kbTableName, setVectorVersion } from "./vectordb.js";
import * as lancedb from "@lancedb/lancedb";
import path from "node:path";
import { config } from "../config.js";

export interface MigrationProgress {
  kbId: string;
  completed: number;
  total: number;
  percent: number;
  eta: number; // 预计剩余秒数
  startTime: number;
  status: "migrating" | "ready" | "failed";
}

const progressMap = new Map<string, MigrationProgress>();

export function getMigrationProgress(kbId: string): MigrationProgress | undefined {
  return progressMap.get(kbId);
}

export async function startMigration(kbId: string): Promise<void> {
  await db
    .update(schema.knowledgeBases)
    .set({ migrationStatus: "migrating" })
    .where(eq(schema.knowledgeBases.id, kbId));
}

export async function runMigration(kbId: string, modelName: string): Promise<void> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.chunks)
    .where(eq(schema.chunks.kbId, kbId));
  const total = row?.n ?? 0;
  if (total === 0) return;

  const startTime = Date.now();
  progressMap.set(kbId, {
    kbId,
    completed: 0,
    total,
    percent: 0,
    eta: 0,
    startTime,
    status: "migrating",
  });

  const suffix = "_v2"; // 固定新版本号
  const dbPath = path.resolve(config.UPLOAD_DIR, "../lancedb");
  const conn = await lancedb.connect(dbPath);
  const newTableName = kbTableName(kbId) + suffix;

  // 删除可能残留的新表
  try {
    await conn.dropTable(newTableName);
  } catch {
    // 表不存在则忽略
  }

  const batchSize = 5;
  const allChunks = await db
    .select()
    .from(schema.chunks)
    .where(eq(schema.chunks.kbId, kbId))
    .orderBy(schema.chunks.chunkIndex);

  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.content);
    const ids = batch.map((c) => c.id);

    // 批量 embed（batchSize=5 已在 embedder.ts 内处理）
    const vectors = await embed(texts, modelName);

    const payloads = batch.map((c) => ({
      chunkId: c.id,
      docId: c.docId,
      content: c.content,
      chunkIndex: c.chunkIndex,
      docFilename: (c.metadata as Record<string, unknown> | null)?.docFilename ?? "",
    }));

    await insertVectors(kbId, vectors, ids, payloads, suffix);

    const completed = Math.min(i + batch.length, total);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = completed / elapsed; // chunks per second
    const remaining = total - completed;
    const eta = rate > 0 ? remaining / rate : 0;

    progressMap.set(kbId, {
      kbId,
      completed,
      total,
      percent: Math.round((completed / total) * 100),
      eta: Math.round(eta),
      startTime,
      status: "migrating",
    });
  }
}

export async function finalizeMigration(kbId: string, newTableSuffix: string): Promise<void> {
  // 校验 chunk 数一致
  const [chunkCountRow] = await db
    .select({ n: count() })
    .from(schema.chunks)
    .where(eq(schema.chunks.kbId, kbId));
  const expectedCount = chunkCountRow?.n ?? 0;

  const dbPath = path.resolve(config.UPLOAD_DIR, "../lancedb");
  const conn = await lancedb.connect(dbPath);
  const newTableName = kbTableName(kbId) + newTableSuffix;

  const newTable = await conn.openTable(newTableName);
  const actualCount = await newTable.countRows();

  if (actualCount !== expectedCount) {
    // 不匹配，标记失败
    await db
      .update(schema.knowledgeBases)
      .set({ migrationStatus: "failed" })
      .where(eq(schema.knowledgeBases.id, kbId));
    progressMap.set(kbId, {
      kbId,
      completed: actualCount,
      total: expectedCount,
      percent: 0,
      eta: 0,
      startTime: 0,
      status: "failed",
    });
    throw new Error(
      `Migration chunk count mismatch: expected ${expectedCount}, got ${actualCount}`,
    );
  }

  // 更新 chunks 的 qdrantPointId 指向新向量（用 chunk id 作为新标识）
  // 此处 qdrantPointId 沿用原 chunk id，无需逐个更新
  // 真实的迁移场景中，需更新指向新表。当前 LanceDB 用 id 做匹配，
  // finalize 主要是做完整性检查和状态切换

  await db
    .update(schema.knowledgeBases)
    .set({ migrationStatus: "ready", vectorVersion: newTableSuffix })
    .where(eq(schema.knowledgeBases.id, kbId));

  // 更新内存缓存，使 searchVectors 自动使用新表
  setVectorVersion(kbId, newTableSuffix);

  progressMap.set(kbId, {
    kbId,
    completed: expectedCount,
    total: expectedCount,
    percent: 100,
    eta: 0,
    startTime: Date.now(),
    status: "ready",
  });
}

export async function rollbackMigration(kbId: string): Promise<void> {
  const suffix = "_v2";
  await dropTable(kbId + suffix);

  await db
    .update(schema.knowledgeBases)
    .set({ migrationStatus: "failed" })
    .where(eq(schema.knowledgeBases.id, kbId));

  progressMap.set(kbId, {
    kbId,
    completed: 0,
    total: 0,
    percent: 0,
    eta: 0,
    startTime: 0,
    status: "failed",
  });
}
