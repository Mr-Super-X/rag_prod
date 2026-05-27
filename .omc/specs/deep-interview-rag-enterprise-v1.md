# Deep Interview Spec: 企业级 RAG 知识库平台 V1

## Metadata
- Interview ID: rag-enterprise-20260526
- Rounds: 6
- Final Ambiguity Score: 19%
- Type: greenfield
- Generated: 2026-05-26
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.90 | 40% | 0.36 |
| Constraint Clarity | 0.80 | 30% | 0.24 |
| Success Criteria | 0.70 | 30% | 0.21 |
| **Total Clarity** | | | **0.81** |
| **Ambiguity** | | | **19%** |

## Goal

构建一个支持多知识库的 RAG 问答平台 V1，供 5-20 人技术团队内部使用。用户可以创建知识库、上传文档、基于文档内容进行自然语言问答并获得引用来源。支持用户登录和基础角色权限。

## Constraints

- **硬件**：单张消费级显卡（RTX 3060/4060/4070，12-16GB 显存）
- **团队**：独立开发者
- **技术栈**：Node.js/TypeScript 后端
- **LLM 部署**：Ollama 管理 Qwen2.5-7B（GGUF Q4 量化），本地推理
- **Embedding**：BGE-large-zh-v1.5，本地运行
- **部署**：Docker Compose 一键启动
- **数据不出内网**：所有推理本地完成

## Non-Goals (V1 不做)

- Reranker 精排（V2 加）
- Kafka 消息队列（V1 用 Redis Streams 或直接同步处理）
- Kubernetes 编排（V1 用 Docker Compose）
- 多租户数据隔离（V1 只有一套实例，团队内共享）
- 监控告警系统（Prometheus/Grafana）
- 多源数据自动同步（Confluence/飞书等）
- 文档增量更新索引
- 灰度发布 / A/B 测试 Prompt

## Acceptance Criteria

- [ ] 用户可以注册账号、登录、获得 JWT token
- [ ] 用户可以创建/查看/编辑/删除知识库（admin 才能删除）
- [ ] 用户可以在知识库中上传 PDF/Word/Markdown/TXT 文档
- [ ] 文档上传后自动解析 → 切分 → Embedding → 存入 Qdrant
- [ ] 用户在知识库中提问，系统返回基于文档的答案 + 引用来源
- [ ] 检索使用向量 + 关键词混合检索（关键词用 PostgreSQL 全文搜索或 jieba 分词）
- [ ] 对话上下文管理：支持多轮对话，追问能理解上下文
- [ ] 用户可查看自己的对话历史
- [ ] 当检索结果相似度全部低于阈值时，返回"未找到"而非编造
- [ ] Docker Compose 一键启动所有服务（API + Qdrant + Ollama + PostgreSQL + Redis）
- [ ] LLM 回答速度：首 token < 2s（单卡下可接受）

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 应该做通用多场景平台 | 垂直场景先验证更务实 | 坚持通用平台起步，V1 即支持多知识库 |
| 用 Python/FastAPI | 文档推荐，但用户熟悉 Node.js | 改用 Node.js/TypeScript，V1 后端是编排层，语言不影响架构 |
| V1 就给团队用 | 自己先用的版本可跳过权限 | 保留登录 + RBAC，但用最小实现 |
| V1 范围由用户定 | 用户说"你帮我定" | 基于文档 §5.1 定制：Qdrant + Ollama + 混合检索 + 对话管理 |

## Technical Context

- **参考 Demo**：`D:\personal\AI\rag` — Node.js/Express + LanceDB + llama-server 的本地 RAG，已验证 Node.js 做 RAG 编排的可行性
- **参考架构文档**：`D:\personal\AI\rag\docs\企业级RAG知识库架构设计与落地.md`
- **工作目录**：`D:\personal\AI\rag_prod` — 空目录，从零构建

## Technology Stack (V1)

| 层 | 选型 | 说明 |
|----|------|------|
| 后端框架 | Node.js + TypeScript + Fastify (或 Express) | 异步 I/O，TS 类型安全 |
| LLM 推理 | Ollama + Qwen2.5-7B (Q4_K_M) | ~5GB 显存，本地推理 |
| Embedding | BGE-large-zh-v1.5 (通过 Ollama 或独立服务) | ~1.3GB 显存 |
| 向量数据库 | Qdrant (Docker) | 单节点，gRPC 接口 |
| 关系数据库 | PostgreSQL 15+ | 用户、知识库、文档元数据 |
| 缓存/会话 | Redis | 会话存储、BM25 关键词索引 |
| 部署 | Docker Compose | 一键启动所有依赖 |

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| KnowledgeBase | core domain | id, name, description, createdBy, createdAt | has many Documents, has many Conversations |
| Document | core domain | id, kbId, filename, fileType, status, chunkCount, uploadedBy, uploadedAt | belongs to KnowledgeBase, has many Chunks |
| Chunk | core domain | id, docId, kbId, content, vectorId, chunkIndex, metadata | belongs to Document |
| User | supporting | id, username, passwordHash, role, createdAt | owns KnowledgeBases, owns Conversations |
| Conversation | core domain | id, kbId, userId, title, createdAt | belongs to KnowledgeBase, belongs to User, has many Messages |
| Message | core domain | id, conversationId, role, content, sources, createdAt | belongs to Conversation |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 4 | 4 | - | - | - |
| 2 | 4 | 0 | 0 | 4 | 100% |
| 3 | 4 | 0 | 0 | 4 | 100% |
| 4 | 4 | 0 | 0 | 4 | 100% |
| 5 | 5 | 1 | 0 | 4 | 80% |
| 6 | 6 | 1 (Chunk, Message) | 0 | 4 | 67% → refined in spec |

> 核心 4 实体 (KnowledgeBase, Document, User, Conversation) 6 轮全稳定。Chunk 和 Message 是规格化阶段自然出现的子实体。

## Interview Transcript
<details>
<summary>Full Q&A (6 rounds)</summary>

### Round 1
**Q:** 文档列出了5种企业RAG场景，你想先聚焦哪个具体场景？
**A:** 通用平台（多场景）
**Ambiguity:** 88% (Goal: 0.30, Constraints: 0.00, Criteria: 0.00)

### Round 2
**Q:** 你目前有什么硬件条件？
**A:** 单张消费级显卡
**Ambiguity:** 76% (Goal: 0.30, Constraints: 0.40, Criteria: 0.00)

### Round 3
**Q:** V1 做到什么程度就算"成功落地了"？
**A:** 你帮我定
**Ambiguity:** 53% (Goal: 0.50, Constraints: 0.55, Criteria: 0.35)

### Round 4 (Contrarian)
**Q:** 假如不做通用多场景平台，先做垂直场景快速验证？
**A:** 坚持通用平台
**Ambiguity:** 45% (Goal: 0.70, Constraints: 0.55, Criteria: 0.35)

### Round 5
**Q:** V1 范围建议确认？
**A:** 可以用 Node 替代 Python 吗
**Ambiguity:** 34% (Goal: 0.75, Constraints: 0.70, Criteria: 0.50)

### Round 6 (Simplifier)
**Q:** 这个 V1 准备给谁用？
**A:** 给团队试用
**Ambiguity:** 19% (Goal: 0.90, Constraints: 0.80, Criteria: 0.70)

</details>
