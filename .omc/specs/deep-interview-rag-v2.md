# Deep Interview Spec: RAG 知识库平台 V2

## Metadata
- Interview ID: rag-v2-20260526
- Rounds: 5
- Final Ambiguity Score: 11%
- Type: brownfield
- Generated: 2026-05-26
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.95 | 35% | 0.33 |
| Constraint Clarity | 0.85 | 25% | 0.21 |
| Success Criteria | 0.85 | 25% | 0.21 |
| Context Clarity | 0.90 | 15% | 0.14 |
| **Total Clarity** | | | **0.89** |
| **Ambiguity** | | | **11%** |

## Goal

在 V1 基础上实现三个核心增强，分两批交付：
- **第一批**：流式输出（SSE）+ JWT 安全加固（access+refresh 双 token + 密码强度）
- **第二批**：本地 BGE-Reranker 精排检索结果

## Constraints

- **硬件**：Intel 核显，无独立 GPU，CPU 推理
- **兼容**：不破坏 V1 已有 API 和前端功能
- **Ollama**：继续用本地模型（Qwen2.5-7B + BGE-m3）
- **Reranker**：本地 CPU 运行 BGE-Reranker-v2-m3，接受每次问答 +200-500ms 延迟
- **流式**：SSE（Server-Sent Events），前端 EventSource 接收
- **JWT**：access token 15min + refresh token 7d，前端自动无感刷新

## Non-Goals (V2 不做)

- 云端 LLM API 接入（用户选择保持本地推理）
- 速率限制（v2.1 再加）
- 多租户数据隔离（v2.1 再加）
- 结构化日志持久化（v2.1 再加）

## Acceptance Criteria

### 第一批：流式输出 + JWT 安全

- [ ] POST `/api/kb/:id/chat` 支持 `Accept: text/event-stream` 返回 SSE 流
- [ ] SSE 流中每个事件包含一个 token，前端逐字渲染
- [ ] 流式回答结束后，前端显示完整的引用来源
- [ ] 登录接口返回 `accessToken`（15min）+ `refreshToken`（7d）
- [ ] 前端自动在 access token 过期前用 refresh token 续签
- [ ] 注册密码最少 8 位，必须包含字母和数字
- [ ] refresh token 存储在 localStorage（access token 放在内存中）
- [ ] 旧版非流式接口仍可正常工作（通过 `Accept` header 区分）

### 第二批：Reranker 精排

- [ ] 检索后 Top-10 结果经过 BGE-Reranker 精排，返回 Top-5
- [ ] Reranker 首次加载模型（~2GB）后常驻内存，后续调用不重新加载
- [ ] Reranker 失败时降级：直接返回 Top-10 不经精排
- [ ] Reranker 延迟控制在 500ms 以内（P99）

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| V2 应该接云端 API 加速 | 逆向挑战：CPU 慢是最大痛点 | 用户选择保持本地推理，解决问题精度和安全 |
| Reranker 用 Cohere API | CPU Reranker 会拖慢 200-500ms | 用户接受延迟，用本地 BGE-Reranker |
| JWT 只加过期时间就够了 | 每次过期重新登录体验差 | 标准 access+refresh 双 token 方案 |
| 流式用 WebSocket | WS 过重，RAG 只需单向推送 | SSE 方案，浏览器原生支持 |

## Technical Context

- **V1 代码库**：`D:\personal\AI\rag_prod`，46 个源文件，Fastify+LanceDB+Ollama+Vue3
- **关键改动文件**：
  - `src/pipeline/generator.ts` — LLM 流式调用
  - `src/routes/chat.ts` — SSE 流式响应
  - `src/services/auth.service.ts` — refresh token 逻辑
  - `src/middleware/auth.ts` — 双 token 验证
  - `src/routes/auth.ts` — /api/auth/refresh 端点
  - `src/pipeline/reranker.ts` — 新文件，BGE-Reranker 封装
  - `src/services/retrieval.service.ts` — 接入 Reranker
  - `client/src/components/ChatPanel.vue` — SSE 接收 + 打字机效果
  - `client/src/components/MessageBubble.vue` — 流式内容渲染
  - `client/src/lib/api.ts` — 自动 refresh token
  - `client/src/pages/LoginPage.vue` / `RegisterPage.vue` — 密码强度

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| RefreshToken | new | id, userId, token, expiresAt | belongs to User |
| Reranker | new (pipeline) | model, loaded | used by Retrieval |
| AccessToken | modified | — (was JWT, now short-lived JWT) | — |

## Ontology Convergence

All V1 entities (KnowledgeBase, Document, Chunk, User, Conversation, Message) carry over unchanged. V2 adds RefreshToken and Reranker as new entities.

## Interview Transcript
<details>
<summary>Full Q&A (5 rounds)</summary>

### Round 1
**Q:** V1 最大痛点？
**A:** 回答不够准, 安全不够, 功能不全
**Ambiguity:** 71%

### Round 2
**Q:** 每个方向挑一个最想做的？
**A:** 全都要，分两批做
**Ambiguity:** 48%

### Round 3
**Q:** 流式输出用哪种方案？
**A:** SSE（推荐）
**Ambiguity:** 31%

### Round 4 (Contrarian)
**Q:** Reranker 用 API 还是本地？
**A:** 用本地 BGE-Reranker
**Ambiguity:** 23%

### Round 5
**Q:** JWT 方案选哪个？
**A:** 标准 access+refresh 双 token
**Ambiguity:** 11%

</details>
