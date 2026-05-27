<!-- Parent: ../AGENTS.md -->

# middleware

## Purpose

`src/middleware/` 认证中间件的单元测试。

## Key Files

| File | Description |
|------|-------------|
| `auth.test.ts` | authenticate, requireAdmin, requireKBAccess 测试 |

## For AI Agents

- 使用 Fastify 的 `app.inject()` 或 mock request/reply 对象
- 测试每种中间件的放行/拒绝路径
- 注意 `requireKBAccess` 的双重检查（createdBy + kb_members）
