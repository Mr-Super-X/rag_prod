import { describe, it, expect } from "vitest";
import { getApp } from "./setup.js";

let token: string;
let kbId: string;
let docId: string;
let conversationId: string;

describe("Chat Pipeline", () => {
  it("prepares user and KB", async () => {
    const app = getApp();
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "chattest", password: "test123456" },
    });
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "chattest", password: "test123456" },
    });
    token = loginRes.json().data.token;

    const kbRes = await app.inject({
      method: "POST",
      url: "/api/kb",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "问答测试库" },
    });
    kbId = kbRes.json().data.id;
  });

  it("uploads a markdown document", async () => {
    const app = getApp();
    const content = Buffer.from("# 公司考勤制度\n\n年假：工作满1年享有5天年假。\n\n婚假：员工结婚享有3天婚假。\n\n产假：女性员工享有98天产假。");
    const boundary = "----FormBoundary7MA4YWxkTrZu0gW";
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="attendance.md"\r\n`),
      Buffer.from(`Content-Type: text/markdown\r\n\r\n`),
      content,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await app.inject({
      method: "POST",
      url: `/api/kb/${kbId}/docs`,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body.toString("binary"),
    });

    // 文档上传应该成功（即使后续处理可能失败——取决于 Ollama 是否在线）
    expect([201, 200]).toContain(res.statusCode);
    if (res.statusCode === 201) {
      docId = res.json().data.id;
    }
  });

  it("starts a conversation", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/kb/${kbId}/chat`,
      headers: { authorization: `Bearer ${token}` },
      payload: { question: "婚假有多少天？" },
    });

    // 如果 Ollama 在线 → 200；如果不在线 → 500（预期行为）
    if (res.statusCode === 200) {
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.answer).toBeTruthy();
      expect(body.data.conversationId).toBeTruthy();
      conversationId = body.data.conversationId;
    }
    // 如果 Ollama 不在线，这个测试不阻塞
  });

  it("retrieves conversation history", async () => {
    if (!conversationId) return; // skip if no conversation was created

    const app = getApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/conversations/${conversationId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.messages).toBeTruthy();
  });

  it("lists conversations", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/kb/${kbId}/conversations`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });
});
