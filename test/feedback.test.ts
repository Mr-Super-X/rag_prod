import { describe, it, expect, beforeAll } from "vitest";
import { getApp } from "./setup.js";
import { db, schema } from "../src/db/index.js";

let tokenA: string;
let tokenB: string;
let msgId: string;

beforeAll(async () => {
  const app = getApp();

  // 注册用户 A 和 B
  await app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "fb_a", password: "test123456" } });
  const loginA = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "fb_a", password: "test123456" } });
  tokenA = loginA.json().data.token;
  const userIdA = loginA.json().data.user.id;

  await app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "fb_b", password: "test123456" } });
  const loginB = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "fb_b", password: "test123456" } });
  tokenB = loginB.json().data.token;

  // 直接在 DB 创建消息（绕过 Ollama）
  const kb = await app.inject({ method: "POST", url: "/api/kb", headers: { authorization: `Bearer ${tokenA}` }, payload: { name: "fb kb" } });
  const kbId = kb.json().data.id;

  const [conv] = await db.insert(schema.conversations).values({ kbId, userId: userIdA, title: "测试对话" }).returning();
  const [msg] = await db.insert(schema.messages).values({ conversationId: conv.id, role: "assistant", content: "测试回答" }).returning();
  msgId = msg.id;
});

describe("Feedback", () => {
  it("rejects unauthenticated requests", async () => {
    const app = getApp();
    const res = await app.inject({ method: "POST", url: `/api/messages/${msgId || "any"}/feedback`, payload: { rating: 1 } });
    expect(res.statusCode).toBe(401);
  });

  it("rejects invalid rating values", async () => {
    if (!msgId) return;
    const app = getApp();
    const res = await app.inject({ method: "POST", url: `/api/messages/${msgId}/feedback`, headers: { authorization: `Bearer ${tokenA}` }, payload: { rating: 0 } });
    expect(res.statusCode).toBe(400);
  });

  it("submits thumbs up", async () => {
    if (!msgId) return;
    const app = getApp();
    const res = await app.inject({ method: "POST", url: `/api/messages/${msgId}/feedback`, headers: { authorization: `Bearer ${tokenA}` }, payload: { rating: 1 } });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.rating).toBe(1);
  });

  it("toggles same rating to cancel", async () => {
    if (!msgId) return;
    const app = getApp();
    // 再点一次同样的
    const res = await app.inject({ method: "POST", url: `/api/messages/${msgId}/feedback`, headers: { authorization: `Bearer ${tokenA}` }, payload: { rating: 1 } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.rating).toBeNull();
  });

  it("switches from up to down", async () => {
    if (!msgId) return;
    const app = getApp();
    // 先赞
    await app.inject({ method: "POST", url: `/api/messages/${msgId}/feedback`, headers: { authorization: `Bearer ${tokenA}` }, payload: { rating: 1 } });
    // 改踩
    const res = await app.inject({ method: "POST", url: `/api/messages/${msgId}/feedback`, headers: { authorization: `Bearer ${tokenA}` }, payload: { rating: -1 } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.rating).toBe(-1);
  });

  it("rejects feedback on other user's message", async () => {
    if (!msgId) return;
    const app = getApp();
    const res = await app.inject({ method: "POST", url: `/api/messages/${msgId}/feedback`, headers: { authorization: `Bearer ${tokenB}` }, payload: { rating: 1 } });
    expect(res.statusCode).toBe(403);
  });
});
