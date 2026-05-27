import { describe, it, expect, beforeAll } from "vitest";
import { getApp } from "./setup.js";

let adminToken: string;
let userToken: string;

beforeAll(async () => {
  const app = getApp();

  // 创建 admin
  await app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "admintest", password: "admin123456" } });
  // 手动提升为 admin（通过 DB）
  const { db, schema } = await import("../src/db/index.js");
  const { eq } = await import("drizzle-orm");
  await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.username, "admintest"));
  const loginA = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admintest", password: "admin123456" } });
  adminToken = loginA.json().data.token;

  // 创建普通用户
  await app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "normaltest", password: "test123456" } });
  const loginU = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "normaltest", password: "test123456" } });
  userToken = loginU.json().data.token;
});

describe("Admin", () => {
  it("rejects non-admin access to admin endpoints", async () => {
    const app = getApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/overview", headers: { authorization: `Bearer ${userToken}` } });
    expect(res.statusCode).toBe(403);
  });

  it("returns overview stats", async () => {
    const app = getApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/overview", headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data).toHaveProperty("totalUsers");
    expect(data).toHaveProperty("totalKBs");
    expect(data).toHaveProperty("totalDocs");
    expect(data).toHaveProperty("totalConvs");
    expect(data).toHaveProperty("todayQuestions");
  });

  it("returns audit logs", async () => {
    const app = getApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/audit-logs?limit=10", headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it("handles invalid limit gracefully", async () => {
    const app = getApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/audit-logs?limit=abc", headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.statusCode).toBe(200);
  });

  it("returns feedback stats", async () => {
    const app = getApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/feedback-stats", headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("upCount");
    expect(data).toHaveProperty("rate");
    expect(Array.isArray(data.recent)).toBe(true);
  });

  it("lists users", async () => {
    const app = getApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/users", headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it("lists KBs with stats", async () => {
    const app = getApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/kbs", headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });
});
