# RALPLAN-DR: RAG 知识库平台 V2 实现方案

## Metadata
- Plan ID: rag-enterprise-v2-plan
- Based on: deep-interview-rag-v2 spec
- V1 Plan: rag-enterprise-v1-plan
- Created: 2026-05-26
- Status: DRAFT

---

## RALPLAN-DR Summary

### Principles (3)
1. **V1 不破坏**：所有 V1 API 保持兼容。流式通过 `Accept: text/event-stream` header 区分，旧客户端仍可非流式调用。
2. **渐进增强**：每个功能独立可开关。Reranker 失败不影响检索；refresh token 失败退回登录页。
3. **最小改动**：优先改 pipeline 层和 middleware 层，路由层和前端组件层改动控制在必要范围。

### Decision Drivers (Top 3)
1. **无 GPU**：Reranker 必须在 CPU 上跑，需要模型加载优化（一次加载常驻内存）。
2. **V1 兼容**：已有用户在用，不能破坏现有文档索引和数据库 Schema。
3. **两批交付**：第一批（流式+JWT）先上，第二批（Reranker）后上。

### Viable Options

| # | Decision | Option A (选择) | Option B | Why A |
|---|----------|---------------|---------|-------|
| 1 | 流式协议 | SSE (fetch+ReadableStream) | WebSocket / EventSource | SSE 格式简单；但因 EventSource 只支持 GET+无自定义 Header，前端用 `fetch()+ReadableStream` 手动解析 SSE，可传 Authorization |
| 2 | JWT 方案 | access(15min) + refresh(7d) | 单 token 24h | 标准做法，refresh 方案自动无感续签 |
| 3 | Reranker 部署 | 进程内加载 ONNX | 独立 Python 服务 | 减少运维复杂度，V1 已验证进程内模型加载可行 |
| 4 | refresh 存储 | localStorage | httpOnly cookie | V1 已用 localStorage，保持一致性 |
| 5 | Reranker 模型 | BGE-Reranker-v2-m3 ONNX | BGE-Reranker-base | m3 多语言效果好，2GB 可接受 |

---

## ADR

**Decision:** V2 在 V1 基础上新增三个能力：SSE 流式输出、access+refresh 双 token JWT、本地 BGE-Reranker 精排。

**Drivers:**
- 用户反馈 V1 三大痛点：回答不够准、安全不够、体验不够流畅
- 无 GPU，所有推理均在 CPU
- V1 代码库已稳定，需向后兼容

**Alternatives considered:**
- 云端 API 替代本地推理：被否决，用户选择保持本地
- WebSocket 流式：被否决，SSE 更简单
- Cohere API Reranker：被否决，用户选择本地

**Consequences:**
- Reranker 增加 ~2GB 内存占用，CPU 推理额外延迟 200-500ms/查询
- refresh token 需要在 PostgreSQL 新增 `refresh_tokens` 表
- SSE 需要前端重构消息渲染逻辑

---

## V2 文件改动清单

### 新增文件 (4)

```
src/pipeline/reranker.ts          # BGE-Reranker 封装 (ONNX)
src/db/migrations/v2_refresh.ts   # refresh_tokens 表 migration
src/routes/auth-refresh.ts        # POST /api/auth/refresh
client/src/composables/useStreamChat.ts  # fetch+ReadableStream SSE 解析
```

### 修改文件 (13)

```
后端 (8):
src/pipeline/generator.ts         # +streamGenerate() 流式方法
src/routes/chat.ts                # SSE 响应分支
src/services/auth.service.ts      # refresh token 签发/验证/轮换
src/middleware/auth.ts             # access token 过期处理
src/routes/auth.ts                 # 密码强度校验
src/db/schema.ts                   # +refresh_tokens 表
src/services/retrieval.service.ts  # +rerank() 调用
src/config.ts                      # +RERANKER_ENABLED, JWT_EXPIRY

前端 (5):
client/src/lib/api.ts              # 自动 refresh + SSE 请求
client/src/components/ChatPanel.vue     # SSE 接收 + 打字机
client/src/components/MessageBubble.vue # 流式内容渲染
client/src/pages/LoginPage.vue     # 自动 refresh 集成
client/src/pages/RegisterPage.vue  # 密码强度提示
```

---

## 分批评细实现步骤

### 第一批：流式输出 + JWT 安全

```
Step 1: config.ts — 新增配置项
        JWT_ACCESS_EXPIRY=15min, JWT_REFRESH_EXPIRY=7d

Step 2: db/schema.ts — 新增 refresh_tokens 表
        id, userId, token, expiresAt, createdAt

Step 3: drizzle-kit generate + migrate

Step 4: auth.service.ts — 改造
        login() 返回 { accessToken, refreshToken }
        refreshAccessToken(refreshToken) 验证+轮换
        register() 密码校验 ≥8位+字母+数字

Step 5: routes/auth.ts — 密码校验 + routes/auth-refresh.ts
        POST /api/auth/refresh → 新 access token

Step 6: middleware/auth.ts — access token 过期返回 401

Step 7: pipeline/generator.ts — 新增 streamGenerate()
        fetch Ollama stream=true, 逐行 yield token

Step 8: routes/chat.ts — SSE 分支
        Accept: text/event-stream → SSE 流
        否则 → 原有非流式

Step 9: client/src/lib/api.ts
        自动 refresh token 拦截器（401→refresh→重试，请求去重防并发竞态）
        refreshToken 存 localStorage，accessToken 存内存变量（不持久化）
        SSE fetch 函数（POST + ReadableStream + Authorization header）

Step 10: client/src/composables/useStreamChat.ts
         fetch()+ReadableStream 手动解析 SSE stream

Step 11: ChatPanel.vue + MessageBubble.vue
         流式渲染逻辑

Step 12: LoginPage.vue + RegisterPage.vue
         密码强度 UI

Step 13: 集成测试
```

### 第二批：Reranker 精排

```
Step 14: src/pipeline/reranker.ts
         BGE-Reranker-v2-m3 ONNX 加载 + rerank()

Step 15: src/services/retrieval.service.ts
         retrieve() 后调用 rerank()

Step 16: src/config.ts
         RERANKER_ENABLED=true/false 开关

Step 17: 测试 Reranker 效果
         验证 Top-10→Top-5 的准确率提升
         验证单次 rerank 延迟 P99 < 500ms
         验证 RERANKER_ENABLED=false 降级正常
```

---

## 数据库变更

```sql
-- 新增表
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
```

---

## API 变更

| 方法 | 路径 | V1 | V2 变更 |
|------|------|----|---------|
| POST | `/api/auth/register` | 无密码强度校验 | 密码 ≥8位 + 字母 + 数字 |
| POST | `/api/auth/login` | 返回 `{token, user}` | 返回 `{accessToken, refreshToken, user}` + 保留 `token` 字段（=accessToken）兼容旧客户端 |
| POST | `/api/auth/refresh` | 不存在 | **新增**，返回新 accessToken |
| POST | `/api/kb/:id/chat` | 非流式 | `Accept: text/event-stream` → SSE 流 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Reranker 2GB 模型内存不足 | `RERANKER_ENABLED=false` 可关闭 |
| SSE 连接在代理层被缓冲 | Nginx `proxy_buffering off` + 后端 `X-Accel-Buffering: no` header |
| refresh token 泄露 | 每次 refresh 轮换 token（旧 token 立即失效） |
| ONNX Reranker 模型不可用 | 降级：跳过 Reranker，直接返回检索 Top-10 |
| 流式响应中断 | 前端检测 EventSource error → 显示已收到的部分内容 |
