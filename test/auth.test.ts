import { describe, it, expect } from "vitest";
import { getApp } from "./setup.js";

let token: string;

describe("Auth", () => {
  it("registers a new user", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "testuser", password: "test123456" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.username).toBe("testuser");
  });

  it("rejects duplicate registration", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "testuser", password: "test123456" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("logs in and returns JWT", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "testuser", password: "test123456" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeTruthy();
    expect(body.data.user.username).toBe("testuser");
    token = body.data.token;
  });

  it("rejects invalid password", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "testuser", password: "wrongpassword" },
    });
    expect(res.statusCode).toBe(401);
  });
});
