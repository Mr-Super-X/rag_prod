import { describe, it, expect } from "vitest";
import { getApp } from "./setup.js";

let token: string;
let kbId: string;

describe("KnowledgeBase CRUD", () => {
  it("logs in first", async () => {
    const app = getApp();
    // 先注册
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "kbtest", password: "test123456" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "kbtest", password: "test123456" },
    });
    token = res.json().data.token;
  });

  it("creates a knowledge base", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/kb",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "测试知识库", description: "用于测试" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe("测试知识库");
    kbId = body.data.id;
  });

  it("lists knowledge bases", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/kb",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it("gets a knowledge base by id", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/kb/${kbId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe("测试知识库");
  });

  it("updates a knowledge base", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/kb/${kbId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "改名后的知识库" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe("改名后的知识库");
  });

  it("rejects unauthenticated access", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/kb",
    });
    expect(res.statusCode).toBe(401);
  });

  it("deletes a knowledge base", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/kb/${kbId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
  });
});
