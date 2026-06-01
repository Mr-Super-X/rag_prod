import * as lancedb from "@lancedb/lancedb";
import { config } from "../config.js";
import path from "node:path";

let db: lancedb.Connection | null = null;

// 缓存每个 KB 的活跃向量表版本号（从 knowledge_bases.vectorVersion 加载）
const versionCache = new Map<string, string>();

export function setVectorVersion(kbId: string, version: string): void {
  versionCache.set(kbId, version);
}

function fullTableName(kbId: string): string {
  const base = kbTableName(kbId);
  const version = versionCache.get(kbId) ?? "";
  return base + version;
}

async function getDB(): Promise<lancedb.Connection> {
  if (!db) {
    const dbPath = path.resolve(config.UPLOAD_DIR, "../lancedb");
    db = await lancedb.connect(dbPath);
  }
  return db;
}

export function kbTableName(kbId: string): string {
  return `kb_${kbId.replace(/-/g, "_")}`;
}

async function tableExists(kbId: string): Promise<boolean> {
  const conn = await getDB();
  const tables = await conn.tableNames();
  return tables.includes(fullTableName(kbId));
}

export async function dropTable(kbId: string): Promise<void> {
  const conn = await getDB();
  const name = fullTableName(kbId);
  try {
    await conn.dropTable(name);
  } catch {
    // ignore
  }
}

export async function insertVectors(
  kbId: string,
  vectors: number[][],
  ids: string[],
  payloads: Record<string, unknown>[],
  tableSuffix?: string,
): Promise<void> {
  const conn = await getDB();
  const name = fullTableName(kbId) + (tableSuffix ?? "");
  const data = ids.map((id, i) => ({
    id,
    vector: vectors[i],
    ...payloads[i],
  }));

  const fullNames = await conn.tableNames();
  const exists = fullNames.includes(name);
  if (exists) {
    const table = await conn.openTable(name);
    await table.add(data);
  } else {
    await conn.createTable(name, data);
  }
}

export async function deleteVectors(kbId: string, ids: string[]): Promise<void> {
  if (!(await tableExists(kbId))) return;
  const conn = await getDB();
  const table = await conn.openTable(fullTableName(kbId));
  const predicate = ids.map((id) => `id = '${id}'`).join(" OR ");
  await table.delete(predicate);
}

export interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export async function searchVectors(
  kbId: string,
  queryVector: number[],
  topK: number,
): Promise<SearchResult[]> {
  if (!(await tableExists(kbId))) return [];
  try {
    const conn = await getDB();
    const table = await conn.openTable(fullTableName(kbId));
    const results = await table
      .search(queryVector)
      .limit(topK)
      .toArray();
    return results.map((r: Record<string, unknown>) => ({
      id: String(r.id || ""),
      score: typeof r._distance === "number" ? 1 - (r._distance as number) : 0,
      payload: r,
    }));
  } catch {
    return [];
  }
}
