import { describe, it, expect, beforeAll } from "vitest";
import { getApp } from "./setup.js";

let tokenA: string;
let tokenB: string;
let userIdA: string;
let msgId: string;

beforeAll(async () => {
  const app = getApp();

  // 注册用户 A
  await app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "user_a", password: "test123456" } });
  const loginA = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "user_a", password: "test123456" } });
  tokenA = loginA.json().data.token;
  userIdA = loginA.json().data.user.id;

  // 注册用户 B
  await app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "user_b", password: "test123456" } });
  const loginB = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "user_b", password: "test123456" } });
  tokenB = loginB.json().data.token;

  // 用户 A 创建 KB + conversation + message（用于测试反馈）
  const kb = await app.inject({ method: "POST", url: "/api/kb", headers: { authorization: `Bearer ${tokenA}` }, payload: { name: "feedback kb" } });
  const kbId = kb.json().data.id;

  const conv = await app.inject({
    method: "POST", url: `/api/kb/${kbId}/chat`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { question: "测试问题" },
  });
  msgId = conv.json().data?.conversationId
    ? (await app.inject({ method: "GET", url: `/api/conversations/${conv.json().data.conversationId}`, headers: { authorization: `Bearer ${tokenA}` } })).json().data.messages[1]?.id
    : null;

  // 如果上面没好，直接查 conversations 列表拿消息
  if (!msgId) {
    const convs = await app.inject({ method: "GET", url: `/api/kb/${kbId}/conversations`, headers: { authorization: `Bearer ${tokenA}` } });
    const cId = convs.json().data[0]?.id;
    if (cId) {
      const msgs = await app.inject({ method: "GET", url: `/api/conversations/${cId}`, headers: { authorization: `Bearer ${tokenA}` } });
      msgId = msgs.json().data.messages?.find((m: { role: string }) => m.role === "assistant")?.id;
    }
  }
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
