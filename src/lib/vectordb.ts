import * as lancedb from "@lancedb/lancedb";
import { config } from "../config.js";
import path from "node:path";

let db: lancedb.Connection | null = null;

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
  return tables.includes(kbTableName(kbId));
}

export async function dropTable(kbId: string): Promise<void> {
  const conn = await getDB();
  const name = kbTableName(kbId);
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
): Promise<void> {
  const conn = await getDB();
  const name = kbTableName(kbId);
  const data = ids.map((id, i) => ({
    id,
    vector: vectors[i],
    ...payloads[i],
  }));

  const exists = await tableExists(kbId);
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
  const table = await conn.openTable(kbTableName(kbId));
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
    const table = await conn.openTable(kbTableName(kbId));
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
