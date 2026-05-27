# RALPLAN-DR: 企业级 RAG 知识库平台 V1 实现方案

## Metadata
- Plan ID: rag-enterprise-v1-plan
- Based on: deep-interview-rag-enterprise-v1 spec
- Created: 2026-05-26
- Status: ITERATION-1 (Architect review done, Critic pending)

---

## RALPLAN-DR Summary

### Principles (3)
1. **编排层薄，逻辑在服务**：Node.js 后端只做路由、校验、编排、聚合。LLM 推理在 Ollama，向量搜索在 Qdrant，数据存在 PostgreSQL。后端不内嵌重计算逻辑。
2. **先跑通链路，再加固**：每个功能模块先实现核心流程（golden path），异常处理和边界情况在 Phase 2 补齐。
3. **实体驱动设计**：以 Ontology 的 6 个实体（KnowledgeBase → Document → Chunk, User, Conversation → Message）为锚点，Schema 先行，API 随后。

### Decision Drivers (Top 3)
1. **单卡显存在 12-16GB**：Ollama Qwen2.5-7B Q4 (~5GB) + Embedding BGE (~1.3GB) = ~6.3GB，可以共存。但 Reranker 必须暂缓。
2. **独立开发者**：V1 必须控制在单人 4-6 周可交付的范围内。不做过度抽象，不做微服务拆分。
3. **多知识库从 Day 1 开始**：User Interview 确认了坚持通用平台。Schema 设计必须支持 `user → many knowledge_bases → many documents` 的层级关系。

### Viable Options

| # | Option | Pros | Cons | Verdict |
|---|--------|------|------|---------|
| A | Fastify + Drizzle ORM + Transformers.js Embedding | TS 类型安全最佳，Drizzle 零抽象，Transformers.js 支持 BGE 模型 | 需额外 onnxruntime-node 依赖，模型 ONNX 可用性未验证，进程内推理违背"编排层薄"原则 | 否决（模型风险 + 原则违背） |
| B | Express + Prisma + Ollama Embedding | Express 用户熟悉，Prisma 功能全，Ollama 统一管理模型 | Embedding 用 nomic-embed-text 中文效果不如 BGE，Express 无类型推导路由 | 否决（中文质量妥协 + 类型安全弱） |
| C | Hono + Knex + 独立 Python Embedding 服务 | Hono 性能极高，Knex 灵活 | 多一个 Python 服务增加运维复杂度，Hono 生态不如 Fastify | 否决（多语言运维负担） |
| D | Fastify + Drizzle ORM + Ollama BGE-m3 Embedding | 统一模型服务（LLM + Embedding 都在 Ollama），零额外依赖，BGE-m3 中文效果接近 BGE-large-zh-v1.5，完全符合"编排层薄"原则 | BGE-m3 中文 MTEB 略低于 BGE-large-zh-v1.5（差 2-5%），Ollama 多模型加载需确认显存 | **选择** |

**为什么不重用参考 Demo 的 Express + LanceDB：**
- LanceDB 嵌入式不适合多用户场景（并发写入冲突）
- Express 路由无类型推导，大型项目维护成本高
- Demo 已验证 Node.js 可行性，但企业级需要更严格的类型约束和更好的中间件生态

---

## ADR (Architecture Decision Record)

**Decision:** Node.js/TypeScript + Fastify + Drizzle ORM + Qdrant + Ollama（统一管理 LLM Qwen2.5-7B + Embedding BGE-m3）

**Drivers:**
- 用户明确要求 Node.js 技术栈
- 单卡 GPU 约束：Qwen2.5-7B Q4 (~5GB) + BGE-m3 (~1.3GB) = ~6.3GB，单卡可同时加载
- 类型安全是第一优先级（独立开发者维护，类型即文档）
- 统一模型服务降低运维复杂度——LLM 和 Embedding 都在 Ollama 管理，一个 `ollama pull` 搞定两个模型
- 完全符合"编排层薄"原则——Node.js 后端不内嵌任何模型推理，所有 AI 计算外移到 Ollama

**Alternatives considered:**
- 方案 A (Transformers.js): 被否决，BGE ONNX 模型可用性未验证 + 违背编排层薄原则 + 额外 onnxruntime-node 依赖
- 方案 B (Express + Prisma + Ollama nomic-embed-text): 被否决，nomic-embed-text 中文效果不足
- 方案 C (Hono + Knex + Python 嵌入服务): 被否决，多语言运维负担

**Why chosen:**
- BGE-m3 中文 MTEB 评分与 BGE-large-zh-v1.5 差距仅 2-5%，V1 可接受
- Ollama 统一管理：`ollama pull qwen2.5:7b && ollama pull bge-m3` ——两条命令完成全部模型准备
- 零额外系统依赖——不需要 onnxruntime-node、不需要 Visual Studio Build Tools

**Consequences:**
- Ollama 的 embedding API 端点为 `/api/embed`，返回格式与 OpenAI embedding API 兼容，一行 fetch 即可
- 如果日后 BGE-large-zh-v1.5 的 ONNX 模型可用且质量差距变得不可接受，可以单独部署 Transformers.js 作为 Embedding 的升级路径（但需全量重建向量索引）

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│              Fastify HTTP Server                  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Auth     │  │ KB       │  │ Chat         │  │
│  │ (JWT)    │  │ (CRUD)   │  │ (RAG Pipeline)│  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │             │               │           │
│       └─────────────┼───────────────┘           │
│                     │                            │
│         ┌───────────┴───────────┐               │
│         │     Service Layer     │               │
│         │  (纯编排，无推理)      │               │
│         └───────────┬───────────┘               │
│                     │                            │
│    ┌────────────────┼────────────────┐           │
│    ▼                ▼                ▼           │
│ ┌────────┐  ┌──────────────┐  ┌───────────┐    │
│ │ Drizzle │  │ Qdrant Client│  │ Ollama    │    │
│ │ (PG)   │  │ (@qdrant/js) │  │ HTTP API  │    │
│ └────────┘  └──────────────┘  │           │    │
│                                │ /api/chat │    │
│                                │ /api/embed│    │
│                                └───────────┘    │
└──────────────────────────────────────────────────┘

External Services (Docker):
  - PostgreSQL 15
  - Qdrant
  - Ollama (Qwen2.5-7B Q4 + BGE-m3)
  - Redis (会话 + BM25 倒排索引)
```

## Data Flow: RAG 问答完整链路

```
1. POST /api/kb/:id/chat
   │  { question: "公司年假怎么算" }
   ▼
2. Auth middleware → 解析 JWT → req.user
   ▼
3. ChatService.ask(kbId, question, userId, conversationId?)
   │
   ├─→ 3a. 意图改写 (ConversationContext)
   │      将"那婚假呢"改写为"公司的婚假政策是什么"
   │      使用 Ollama 轻量 prompt（temperature=0.1, max_tokens=100）
   │      超时 2s，失败则退回原始 query
   │      上次 3 轮对话作为上下文
   │
   ├─→ 3b. Embedding (Ollama /api/embed)
   │      question → [1024-dim vector] (BGE-m3)
   │
   ├─→ 3c. 混合检索
   │      ├─ Qdrant.search(vector, collection=`kb_{kbId}`, topK=25)  每 KB 独立 Collection
   │      └─ BM25 关键词 (Redis 倒排索引 + @node-rs/jieba 中文分词, topK=25)
   │
   ├─→ 3d. RRF 结果融合 → Top-10 (k=60)
   │      RRF_score(d) = Σ 1/(k + rank_r(d))  over vector + BM25 rankings
   │
   ├─→ 3e. LLM 生成 (Ollama)
   │      System prompt: "基于以下文档回答..."
   │      User: question + retrieved chunks
   │
   ├─→ 3f. 兜底判定
   │      similarity all < 0.5 → "未找到相关内容"
   │
   └─→ 3g. 存入 Message (user + assistant)
         返回 { answer, sources }
```

## Database Schema (PostgreSQL + Drizzle)

```sql
-- users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',  -- 'admin' | 'user'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- knowledge_bases
CREATE TABLE knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  file_type VARCHAR(20) NOT NULL,  -- 'pdf' | 'docx' | 'md' | 'txt'
  file_size BIGINT,
  storage_path VARCHAR(500) NOT NULL,  -- Docker volume 路径
  status VARCHAR(20) NOT NULL DEFAULT 'processing', -- 'queued' | 'processing' | 'ready' | 'error'
  chunk_count INT DEFAULT 0,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- chunks (映射表，实际向量在 Qdrant)
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  qdrant_point_id VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  chunk_index INT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,  -- 'user' | 'assistant'
  content TEXT NOT NULL,
  sources JSONB,  -- [{chunkId, content, score, docFilename}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_documents_kb_id ON documents(kb_id);
CREATE INDEX idx_chunks_doc_id ON chunks(doc_id);
CREATE INDEX idx_chunks_kb_id ON chunks(kb_id);
CREATE INDEX idx_chunks_qdrant_point_id ON chunks(qdrant_point_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_kb_id ON conversations(kb_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
```

## API Endpoints

```
POST   /api/auth/register          # 注册
POST   /api/auth/login             # 登录 → JWT

GET    /api/kb                     # 我的知识库列表
POST   /api/kb                     # 创建知识库
GET    /api/kb/:id                 # 知识库详情
PATCH  /api/kb/:id                 # 编辑知识库
DELETE /api/kb/:id                 # 删除知识库 (admin only)

POST   /api/kb/:id/docs            # 上传文档 (multipart)
GET    /api/kb/:id/docs            # 文档列表
DELETE /api/kb/:id/docs/:docId     # 删除文档

POST   /api/kb/:id/chat            # 提问 (SSE stream)
GET    /api/kb/:id/conversations   # 我的对话列表
GET    /api/conversations/:id      # 对话详情 (含消息历史)
DELETE /api/conversations/:id      # 删除对话
```

## Project Structure

```
rag_prod/
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── .env.example
├── src/
│   ├── server.ts                  # Fastify 启动入口
│   ├── app.ts                     # Fastify app 工厂，注册 plugins/routes
│   ├── config.ts                  # 环境变量读取 + 校验
│   ├── db/
│   │   ├── index.ts               # Drizzle + postgres 连接
│   │   ├── schema.ts              # 所有表定义
│   │   └── migrations/            # Drizzle Kit 生成的 SQL
│   ├── routes/
│   │   ├── auth.ts                # POST /api/auth/*
│   │   ├── kb.ts                  # /api/kb/*
│   │   ├── doc.ts                 # /api/kb/:id/docs/*
│   │   └── chat.ts               # /api/kb/:id/chat + /api/conversations/*
│   ├── services/
│   │   ├── auth.service.ts        # 注册/登录/密码 hash
│   │   ├── kb.service.ts          # 知识库 CRUD
│   │   ├── doc.service.ts         # 文档上传/解析/切分/索引
│   │   ├── retrieval.service.ts   # 混合检索 (Qdrant + BM25/Redis/jieba + RRF)
│   │   ├── chat.service.ts        # 问答编排 (改写→检索→生成)
│   │   └── context.service.ts     # 对话上下文管理
│   ├── pipeline/
│   │   ├── parser.ts              # 文档解析 (PDF/Word/MD/TXT)
│   │   ├── splitter.ts            # 文本切分 (RecursiveCharacterTextSplitter)
│   │   ├── embedder.ts            # Ollama /api/embed 封装 (BGE-m3, 1024D)
│   │   └── generator.ts           # Ollama /api/chat 封装 (Qwen2.5-7B)
│   ├── middleware/
│   │   └── auth.ts                # JWT 验证中间件
│   ├── lib/
│   │   ├── qdrant.ts              # Qdrant 客户端 + 工具函数
│   │   ├── redis.ts               # Redis 客户端
│   │   └── errors.ts              # 自定义错误类 + 错误处理器
│   └── types.ts                   # 共享类型定义
├── scripts/
│   └── seed.ts                    # 初始化 admin 用户
└── test/                          # Vitest 集成测试
    ├── setup.ts
    ├── auth.test.ts
    ├── kb.test.ts
    └── chat.test.ts
```

## Build Order (Phase 1: 基础设施 → Phase 2: 核心链路 → Phase 3: 完善)

### Phase 1: 项目骨架 + 基础设施 (Day 1-4)
```
Step 0: Ollama 模型就绪验证
        ollama pull qwen2.5:7b && ollama pull bge-m3
        验证 /api/chat 和 /api/embed 端点均正常响应
Step 1: 项目初始化 + Docker Compose (PG + Qdrant + Redis + Ollama)
Step 2: Drizzle Schema + Migration
Step 3: Fastify app 骨架 + config + error handler + 结构化日志
Step 4: Auth (注册/登录/JWT 中间件)
Step 5: Knowledge Base CRUD 接口 (MOVE FROM Phase 3)
Step 6: 基础测试框架 Vitest + test setup
```

### Phase 2: 核心 RAG 链路 (Day 5-11)
```
Step 7: Embedding 服务封装 (Ollama /api/embed 调 BGE-m3)
Step 8: 文档解析器 (PDF/Word/MD/TXT)
Step 9: 文本切分器 (RecursiveCharacterTextSplitter, chunk_size=500, overlap=50)
Step 10: 文档上传 → 解析 → 切分 → Embedding → Qdrant 索引 完整链路
Step 11: 混合检索 (Qdrant per-KB Collection + BM25 via @node-rs/jieba + Redis)
Step 12: LLM 生成 + Prompt 模板
Step 13: 单轮问答接口 + sources 返回格式定义
Step 14: 集成测试 (上传文档 → 提问 → 验证答案)
```

### Phase 3: 多轮对话 + 完善 (Day 12-14)
```
Step 15: Conversation + Message 接口
Step 16: 对话上下文改写 (temperature=0.1, timeout=2s, fallback to raw query)
Step 17: 检索兜底策略 (similarity < 0.5 → "未找到")
Step 18: Docker Compose 最终编排 + 启动脚本 + GPU passthrough 文档
Step 19: 全流程 E2E 测试
Step 20: 错误处理 + 日志完善
```

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|-----------|
| Ollama BGE-m3 + Qwen2.5-7B 同时加载显存不足 | Low | High | 实测 Q4 7B (~5GB) + BGE-m3 (~1.3GB) = ~6.3GB，12GB 卡余量充足。若仍溢出则 Embedding 调用时临时卸载 LLM |
| 中文 BM25 分词效果差于预期 | Medium | Medium | @node-rs/jieba 提供预编译二进制，词库可自定义。若 C-MTEB 不达标，降级为只用 Qdrant 向量检索（去掉 BM25 分支），延迟 5ms |
| Qdrant 单节点内存泄漏 | Medium | Medium | 设置 Docker memory limit + healthcheck 自动重启 |
| Ollama 并发请求排队导致问答超时 | High | Medium | 前端 loading 提示 + Fastify SSE 设置 120s timeout + keepalive ping |
| PDF 解析对大文件内存溢出 | Medium | Low | 设 50MB 上传限制，stream 处理大文件 |
| Docker Compose on Windows GPU passthrough | Medium | Medium | 提供 GPU 直通配置文档 + `docker-compose.cpu-only.yml` 降级方案（Ollama 跑 CPU，慢但可用） |
| V1 多知识库无访问控制 | High | Low | 明确记录在 AC 中：V1 所有认证用户可访问所有知识库，权限控制在 V2 补充 |

---

## Appendix: Key npm Packages

| Package | Version | Purpose |
|---------|---------|---------|
| fastify | ^5.x | HTTP framework |
| @fastify/jwt | ^9.x | JWT auth |
| @fastify/multipart | ^9.x | File upload |
| @fastify/cors | ^10.x | CORS |
| @fastify/swagger | ^10.x | OpenAPI 自动生成 |
| drizzle-orm | ^0.40.x | ORM |
| drizzle-kit | ^0.30.x | Migration generator |
| postgres | ^3.x | PG driver |
| @qdrant/js-client-rest | ^1.x | Qdrant REST client (V1 单节点 REST 足够) |
| pdf-parse | ^1.x | PDF text extraction (V1 内部使用，V2 换 pdfjs-dist) |
| mammoth | ^1.x | Word (.docx) extraction |
| @node-rs/jieba | ^2.x | 中文分词 (BM25，预编译二进制，Windows 友好) |
| bcryptjs | ^2.x | Password hashing |
| ioredis | ^5.x | Redis client (会话 + BM25 倒排索引) |
| zod | ^3.x | Validation |
| vitest | ^3.x | Testing |

> **注意**：不依赖 `onnxruntime-node`、`@xenova/transformers`——Embedding 统一走 Ollama `/api/embed` 端点。
