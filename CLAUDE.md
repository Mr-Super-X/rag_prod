# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

企业级 RAG 知识库平台。后端 Fastify + TypeScript，前端 Vue 3 + Vite。支持多知识库管理、文档摄入（PDF/Word/MD/TXT）、混合检索（向量 + BM25 + RRF 融合）、多轮对话（上下文改写）、SSE 流式输出、来源追溯。

## 开发环境

```bash
# 基础设施（PostgreSQL + Redis + Ollama）- 首次启动
docker-compose up -d

# 拉取模型（仅首次）
docker exec -it rag_prod-ollama-1 ollama pull qwen2.5:7b
docker exec -it rag_prod-ollama-1 ollama pull bge-m3

# 初始化数据库
npm install
npx drizzle-kit generate
npx drizzle-kit migrate

# 启动后端（http://localhost:3000，Swagger http://localhost:3000/docs）
npm run dev

# 启动前端（http://localhost:5173，API 代理自动到 3000）
cd client && npm install && npm run dev

# 运行集成测试（需要 PG + Redis 在线）
npm test

# E2E 测试（需要前后端均在线）
npm run test:e2e

# 数据库备份
npm run backup
```

## 技术栈

| 层 | 技术 |
|----|------|
| 后端框架 | Fastify + `@fastify/jwt`, `@fastify/cors`, `@fastify/multipart`, `@fastify/swagger` |
| 数据库 | PostgreSQL + Drizzle ORM（`src/db/schema.ts` → `drizzle-kit generate/migrate`） |
| 向量库 | LanceDB（嵌入式，数据在 `data/lancedb/`） |
| LLM | Ollama — Qwen2.5-7B（生成，`src/pipeline/generator.ts`），可选 DeepSeek API |
| Embedding | Ollama — BGE-m3（1024 维，`src/pipeline/embedder.ts`） |
| 缓存/BM25 | Redis（ioredis，`src/lib/redis.ts`） |
| 配置 | `.env` → Zod 校验 → `src/config.ts` |
| 前端 | Vue 3 + Pinia + Vue Router，`client/` 目录独立 |

## 架构：请求与数据流

### 文档摄入流程

```
POST /api/kb/:id/docs
  → docRoutes 接收文件 → 校验类型 → 存磁盘
  → processDocument() 创建 DB 记录(status=processing)，立即返回
  → 后台异步 processDocumentAsync():
      parseFile(根据扩展名调 pdf-parse/mammoth/直接读)
      → splitText(按段落切分，500字块+50字重叠)
      → embed(调 Ollama BGE-m3，每批 5 条)
      → insertVectors(LanceDB) + 写入 PG chunks 表 + indexBM25(Redis 倒排)
      → 更新文档 status=ready
```

### 问答流程

```
POST /api/kb/:id/chat
  → chatRoutes 鉴权 → ask() 或 SSE 流式分支
  → streamAsk() / ask():
      1. 创建/获取 conversation
      2. rewriteQuestion(LLM 上下文改写，补全指代)
      3. 保存用户消息
      4. retrieve(kbId, rewrittenQuestion):
           embedSingle(query) → searchVectors(LanceDB, topK=25)
           + bm25Search(Redis 倒排，中文 jieba 分词/bigram 降级)
           → RRF 融合(分数重排) → 可选 reranker → 返回 topK=10
      5. generate(context + history) 调 Ollama chat → 保存回答 → 返回
```

### 路由注册方式

每个路由模块导出 `async function xxxRoutes(app: FastifyInstance)`，在 `src/app.ts` 中通过 `app.register()` 注册。Swagger schema 直接以 JSON Schema 字面量写在路由参数上。

### 错误处理

- `src/lib/errors.ts` 定义了 `AppError` / `NotFoundError` / `UnauthorizedError` / `ForbiddenError`
- `app.setErrorHandler(errorHandler)` 统一兜底，返回 `{ success: false, error: { code, message } }`
- 服务层抛出这些 AppError 子类，路由层不写 try-catch

### 认证

JWT access token（15 分钟内存） + refresh token（7 天 DB 存储，rotation 机制）。
中间件：`authenticate`（验证 JWT）、`requireAdmin`（仅 admin 角色）、`requireKBAccess`（KB 成员/创建者权限）。
`authenticate` 通过 `app.addHook("onRequest", authenticate)` 挂载到需认证的路由组。
前端：accessToken 内存保存，refreshToken localStorage，401 自动静默刷新。

## 数据库

8 张表：`users`, `knowledge_bases`, `kb_members`, `documents`, `chunks`, `conversations`, `messages`, `refresh_tokens`。
定义在 `src/db/schema.ts`，外键级联删除（kb → docs → chunks → messages, kb → kb_members）。
修改 schema 后：`npx drizzle-kit generate` → `npx drizzle-kit migrate`。

## 重要约定

- 所有 API 返回格式：`{ success: boolean, data?: T, error?: { code: string, message: string } }`
- 环境变量通过 `src/config.ts` 的 Zod schema 解析，新增变量需同时在 `.env.example` 和 schema 中添加
- 前端 API 调用全部走 `client/src/lib/api.ts` 的 `api` 对象，自动处理 auth header 和 401 refresh
- PDF 解析用 `pdf-parse`，Word 用 `mammoth`，都是动态 import
- BM25 中文分词优先用 `@node-rs/jieba`，不可用时降级为字符 bigram
- Reranker 默认关闭（`RERANKER_ENABLED=false`），开启后对 topK=25 用 LLM 逐条打分后取 topK=10
- 测试环境用独立数据库 `ragtest`（见 `vitest.config.ts`）
- 生产部署用 PM2（`ecosystem.config.cjs`）
- LLM 提供者支持切换：`LLM_PROVIDER=ollama`（本地 CPU，慢但免费）或 `LLM_PROVIDER=deepseek`（云端 API，秒级但需 `DEEPSEEK_API_KEY`），失败自动降级到本地
- Agent 功能通过 `AGENT_ENABLED=true` 开关控制（意图检测 + 时间查询 + 计算器），检索前拦截
- KB 多租户隔离：`kb_members` 表 + `requireKBAccess` 中间件，非成员/非创建者无法访问
- 速率限制：全局 60 req/min，超标返回 429
- 文档进度轮询在前端自动处理（`DocList.vue` 每 3 秒检查，全部就绪后停止）
- 备份系统：`npm run backup` 自动备份 PG dump + LanceDB tar.gz + 上传文件，7 天自动清理
