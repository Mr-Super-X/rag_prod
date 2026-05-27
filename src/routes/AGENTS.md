<!-- Parent: ../AGENTS.md -->

# routes

## Purpose

REST API 路由定义。每个文件对应一个路由组，注册在 `/api/` 前缀下。

## Key Files

| File | Description |
|------|-------------|
| `auth.ts` | `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`（无需认证） |
| `kb.ts` | `/api/kb` CRUD（需认证） |
| `doc.ts` | `/api/kb/:id/docs` 上传/列表/删除（需认证） |
| `chat.ts` | `/api/kb/:id/chat`（SSE 流式 + 非流式兼容），对话管理（需认证） |

## For AI Agents

### Working In This Directory

- 路由模块导出 `async function xxxRoutes(app: FastifyInstance)`
- 需在 `src/app.ts` 中 `app.register(xxxRoutes)` 注册
- Swagger schema 以 `const xxxBody = { type: "object", ... } as const` 定义在文件顶部
- 所有需认证的路由用 `app.addHook("onRequest", authenticate)` 统一挂载

### Common Patterns

- 返回格式：`{ success: true, data: result }` 或 `reply.status(201).send(...)`
- 204 DELETE 用 `reply.status(204).send()`
- SSE 流式直接操作 `reply.raw`（绕过 Fastify 的响应封装）
