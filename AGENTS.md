# RAG Enterprise Knowledge Base Platform

## Purpose

企业级 RAG（检索增强生成）知识库问答平台。支持多知识库管理、文档摄入（PDF/Word/MD/TXT）、
混合检索（LanceDB 向量 + Redis BM25 + RRF 融合）、多轮对话（上下文改写）、SSE 流式输出、
来源追溯。详见 `CLAUDE.md` 获取完整架构、命令和约定。

## Key Files

| File | Description |
|------|-------------|
| `package.json` | 后端依赖与脚本（Fastify + Drizzle + LanceDB + ioredis） |
| `tsconfig.json` | TypeScript 配置（target ES2022, module ESNext, bundler 解析） |
| `vitest.config.ts` | 测试配置（用 `ragtest` 数据库，30s 超时） |
| `drizzle.config.ts` | Drizzle Kit 配置（指向 `src/db/schema.ts`） |
| `docker-compose.yml` | 容器编排：PostgreSQL 15 + Redis 7 + Ollama |
| `docker-compose.mac.yml` | macOS 专用（Ollama 原生运行，仅 PG + Redis） |
| `ecosystem.config.cjs` | PM2 集群配置（2 实例） |
| `CLAUDE.md` | 完整开发指引——命令、架构、数据流、约定。优先读取。 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | 后端源码（Fastify + 服务层 + pipeline + 路由） |
| `client/` | Vue 3 前端（独立 `package.json`） |
| `test/` | 后端集成测试（Vitest） |
| `docs/` | 项目文档（架构、部署、用户指南） |
| `scripts/` | 工具脚本 |

## For AI Agents

### Working In This Directory

- 根目录的 `package.json` 是**后端**的。前端在 `client/package.json`
- 数据库 schema 修改后必须运行 `npx drizzle-kit generate` + `npx drizzle-kit migrate`
- `.env` 不可提交。新增环境变量需同步到 `src/config.ts`（Zod schema）和 README

### Common Patterns

- 全 TypeScript，模块系统 `"type": "module"`
- 所有 API 返回 `{ success: boolean, data?: T, error?: { code, message } }`
- 路由在 `src/app.ts` 通过 `app.register(routeModule)` 注册

## Dependencies

### External

- **Ollama** — Qwen2.5-7B（生成）+ BGE-m3（嵌入），需要预先拉取模型
- **PostgreSQL 15** — 元数据存储（Drizzle ORM）
- **Redis 7** — 会话缓存 + BM25 倒排索引
- **LanceDB** — 嵌入式向量数据库（无服务端，数据存 `data/lancedb/`）
