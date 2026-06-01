import { describe, it, expect, beforeAll } from "vitest";
import { getApp } from "./setup.js";

let adminToken: string;
let userToken: string;
let kbId: string;

beforeAll(async () => {
  const app = getApp();
  // 注册 admin 用户 + 设置 role=admin
  await app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "v12admin", password: "test123456" } });
  // 通过 DB 直接设 role=admin（无专门的 promote API）
  const { db, schema } = await import("../src/db/index.js");
  const { eq } = await import("drizzle-orm");
  await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.username, "v12admin"));

  const r1 = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "v12admin", password: "test123456" } });
  adminToken = r1.json().data.accessToken || r1.json().data.token;

  // 创建 KB
  const r3 = await app.inject({ method: "POST", url: "/api/kb", headers: { authorization: `Bearer ${adminToken}` }, payload: { name: "V12TestKB" } });
  kbId = r3.json().data.id;

  // 普通用户
  await app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "v12normal2", password: "test123456" } });
  const r4 = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "v12normal2", password: "test123456" } });
  userToken = r4.json().data.accessToken || r4.json().data.token;
});

describe("V12 Admin APIs", () => {
  it("GET /admin/trends returns 30-day data", async () => {
    const res = await getApp().inject({ method: "GET", url: "/api/admin/trends?days=7", headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.days).toHaveLength(7);
  });

  it("GET /admin/trends with days>90 caps at 90", async () => {
    const res = await getApp().inject({ method: "GET", url: "/api/admin/trends?days=200", headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.days.length).toBeLessThanOrEqual(90);
  });

  it("GET /admin/error-docs returns array", async () => {
    const res = await getApp().inject({ method: "GET", url: "/api/admin/error-docs", headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it("admin endpoints reject normal user", async () => {
    const res = await getApp().inject({ method: "GET", url: "/api/admin/trends", headers: { authorization: `Bearer ${userToken}` } });
    expect(res.statusCode).toBe(403);
  });
});

describe("V12 Doc APIs", () => {
  it("GET progress returns 40x for nonexistent doc", async () => {
    const res = await getApp().inject({ method: "GET", url: `/api/kb/${kbId}/docs/nonexistent/progress`, headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("POST retry returns 40x for nonexistent doc", async () => {
    const res = await getApp().inject({ method: "POST", url: `/api/kb/${kbId}/docs/nonexistent/retry`, headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});
