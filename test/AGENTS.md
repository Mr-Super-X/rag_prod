<!-- Parent: ../AGENTS.md -->

# test

## Purpose

后端集成测试。用 Vitest + 独立测试数据库 `ragtest`，每个测试套件通过 `setup.ts` 自动建表。

## Key Files

| File | Description |
|------|-------------|
| `setup.ts` | beforeAll 自动 DROP/CREATE 六张表，构建 Fastify app 实例 |
| `auth.test.ts` | 注册、登录、JWT 认证测试 |
| `kb.test.ts` | 知识库 CRUD 测试 |
| `chat.test.ts` | 问答流程测试 |

## For AI Agents

### Working In This Directory

- 测试需要 PostgreSQL 和 Redis 在线（`docker-compose up -d`）
- 使用独立数据库 `ragtest`（见 `vitest.config.ts`），不会污染开发数据
- `setup.ts` 中的 `getApp()` 可获取 Fastify 实例用于 `app.inject()` 测试

### Common Patterns

- 用 `app.inject()` 模拟 HTTP 请求，不走网络层
- 测试间共享的 app 实例通过 `setup.ts` 的 beforeAll/afterAll 管理

## Dependencies

### Internal

- `src/app.ts` — `buildApp()` 工厂函数
- `src/db/index.ts` — 数据库连接

### External

- `vitest` 3 — 测试运行器
