<!-- Parent: ../AGENTS.md -->

# lib

## Purpose

前端基础库。API 客户端封装，统一处理认证、自动刷新 token 和错误。

## Key Files

| File | Description |
|------|-------------|
| `api.ts` | HTTP 客户端：`api.get/post/patch/delete/upload()` + `streamChat()` SSE 流式 |

## For AI Agents

### Working In This Directory

- 前端所有 API 调用必须经此处的 `api` 对象，不要直接 fetch
- accessToken 存内存（页面刷新清空），refreshToken 存 localStorage
- 401 响应自动触发 refresh token 静默刷新，并发请求共享同一个 refresh promise

### Common Patterns

- `api.post<T>(url, body)` 泛型参数为 `data` 字段的类型
- 文件上传用 `api.upload<T>(url, formData)`，FormData 放文件内容
- SSE 用 `streamChat()`，返回 `AbortController` 用于取消
