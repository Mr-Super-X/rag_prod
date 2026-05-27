<!-- Parent: ../AGENTS.md -->

# src

## Purpose

后端源码。Fastify HTTP 服务，分层架构：路由 → 服务 → 数据层（PG + LanceDB + Redis）。
文档摄入 pipeline 和问答 pipeline 均在此实现。

## Key Files

| File | Description |
|------|-------------|
| `server.ts` | 入口：构建 app → seed admin → listen :3000 |
| `app.ts` | Fastify 工厂：注册插件（CORS/JWT/Multipart/Swagger）和所有路由 |
| `config.ts` | 环境变量加载 + Zod 校验（LLM_MODEL, EMBEDDING_DIM, RRF_K 等 20 项） |
| `types.ts` | 共享类型：UserPayload, ChunkSource, ChatRequest/Response, DocumentUploadResult |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `__tests__/` | 单元测试（纯函数、无外部依赖） |
| `db/` | Drizzle ORM schema 定义和数据库连接 |
| `lib/` | 基础设施封装：LanceDB、Redis、错误类 |
| `middleware/` | Fastify 中间件（JWT auth） |
| `pipeline/` | 文档处理流水线（解析→切分→嵌入→生成→重排） |
| `routes/` | REST API 端点（auth/kb/doc/chat/admin） |
| `services/` | 业务逻辑层（认证、知识库、文档、检索、对话、问答） |
| `types/` | TypeScript 类型声明（`pdf-parse.d.ts` 等） |

## For AI Agents

### Working In This Directory

- 新增服务模块放在 `services/`，新增路由模块放在 `routes/`
- 路由模块必须导出 `async function xxxRoutes(app: FastifyInstance)`
- 在 `src/app.ts` 中注册新路由：`await app.register(xxxRoutes)`
- 错误处理用 `src/lib/errors.ts` 中的 `AppError` 子类，由全局 errorHandler 统一兜底

### Common Patterns

- 三层架构：route（校验+响应）→ service（编排）→ db/lib（数据访问）
- Route 中鉴权用 `app.addHook("onRequest", authenticate)`
- Swagger schema 以 JSON Schema 字面量直接写在路由参数上

## Dependencies

### Internal

- `src/config.ts` — 被几乎所有模块引用
- `src/db/index.ts` — 数据库连接（services 层依赖）

### External

- `fastify` + `@fastify/jwt`, `@fastify/cors`, `@fastify/multipart`, `@fastify/swagger`
- `drizzle-orm` — PostgreSQL ORM
- `@lancedb/lancedb` — 向量数据库
- `ioredis` — Redis 客户端
