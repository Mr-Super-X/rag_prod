import { describe, it, expect, beforeAll } from "vitest";
import { getApp } from "./setup.js";

let adminToken: string;
let userToken: string;
let kbId: string;

beforeAll(async () => {
  const app = getApp();
  // 注册 admin 用户 + 设置 role=admin
  await app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "v13admin", password: "test123456" } });
  const { db, schema } = await import("../src/db/index.js");
  const { eq } = await import("drizzle-orm");
  await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.username, "v13admin"));

  const r1 = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "v13admin", password: "test123456" } });
  adminToken = r1.json().data.accessToken || r1.json().data.token;

  const r2 = await app.inject({ method: "POST", url: "/api/kb", headers: { authorization: `Bearer ${adminToken}` }, payload: { name: "V13TestKB" } });
  kbId = r2.json().data.id;

  // 普通用户 for auth test
  await app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "v13norm2", password: "test123456" } });
  const r3 = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "v13norm2", password: "test123456" } });
  userToken = r3.json().data.accessToken || r3.json().data.token;
});

describe("V13 AI Engine APIs", () => {
  it("GET /models returns array", async () => {
    const res = await getApp().inject({ method: "GET", url: "/api/admin/ai-engine/models", headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it("GET /config returns expected fields", async () => {
    const res = await getApp().inject({ method: "GET", url: "/api/admin/ai-engine/config", headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.statusCode).toBe(200);
    const d = res.json().data;
    expect(d).toHaveProperty("embeddingModel");
    expect(d).toHaveProperty("llmProvider");
    expect(d).toHaveProperty("llmModel");
  });

  it("POST /config updates LLM provider", async () => {
    const app = getApp();
    const before = await app.inject({ method: "GET", url: "/api/admin/ai-engine/config", headers: { authorization: `Bearer ${adminToken}` } });
    const orig = before.json().data.llmProvider;
    const res = await app.inject({ method: "POST", url: "/api/admin/ai-engine/config", headers: { authorization: `Bearer ${adminToken}` }, payload: { llmProvider: orig } });
    expect(res.statusCode).toBe(200);
  });

  it("POST /migrate starts migration for existing KB", async () => {
    const res = await getApp().inject({ method: "POST", url: `/api/admin/ai-engine/migrate/${kbId}`, headers: { authorization: `Bearer ${adminToken}` }, payload: {} });
    expect(res.statusCode).toBe(202);
  });

  it("POST /benchmark with empty questions returns empty array", async () => {
    const res = await getApp().inject({ method: "POST", url: "/api/admin/ai-engine/benchmark", headers: { authorization: `Bearer ${adminToken}` }, payload: { kbId, questions: [] } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });

  it("AI engine endpoints require admin auth", async () => {
    const res = await getApp().inject({ method: "GET", url: "/api/admin/ai-engine/config", headers: { authorization: `Bearer ${userToken}` } });
    expect(res.statusCode).toBe(403);
  });
});
