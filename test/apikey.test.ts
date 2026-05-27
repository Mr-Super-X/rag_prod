import { describe, it, expect, beforeAll } from "vitest";
import { getApp } from "./setup.js";

let token: string;
let apiKey: string;
let keyId: string;

beforeAll(async () => {
  const app = getApp();
  await app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "apikey_user", password: "test123456" } });
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "apikey_user", password: "test123456" } });
  token = login.json().data.token;
});

describe("API Key", () => {
  it("rejects unauthenticated key generation", async () => {
    const app = getApp();
    const res = await app.inject({ method: "POST", url: "/api/auth/api-keys", payload: { name: "test" } });
    expect(res.statusCode).toBe(401);
  });

  it("generates a new API key", async () => {
    const app = getApp();
    const res = await app.inject({ method: "POST", url: "/api/auth/api-keys", headers: { authorization: `Bearer ${token}` }, payload: { name: "测试密钥" } });
    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.key).toBeTruthy();
    expect(data.key.startsWith("ak_")).toBe(true);
    expect(data.keyPrefix).toBeTruthy();
    apiKey = data.key;
    keyId = data.id;
  });

  it("lists user's API keys", async () => {
    const app = getApp();
    const res = await app.inject({ method: "GET", url: "/api/auth/api-keys", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it("revokes an API key", async () => {
    if (!keyId) return;
    const app = getApp();
    const res = await app.inject({ method: "DELETE", url: `/api/auth/api-keys/${keyId}`, headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(204);
  });

  it("rejects revoked API key on chat", async () => {
    if (!apiKey) return;
    const app = getApp();
    // 先创建 KB
    const kb = await app.inject({ method: "POST", url: "/api/kb", headers: { authorization: `Bearer ${token}` }, payload: { name: "api kb" } });
    const kbId = kb.json().data.id;

    const res = await app.inject({
      method: "POST", url: `/api/kb/${kbId}/chat`,
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { question: "test" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects invalid API key format", async () => {
    const app = getApp();
    const kb = await app.inject({ method: "POST", url: "/api/kb", headers: { authorization: `Bearer ${token}` }, payload: { name: "bad kb" } });
    const kbId = kb.json().data.id;

    const res = await app.inject({
      method: "POST", url: `/api/kb/${kbId}/chat`,
      headers: { authorization: "Bearer not_a_real_key" },
      payload: { question: "test" },
    });
    expect(res.statusCode).toBe(401);
  });
});
