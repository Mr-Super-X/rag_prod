# Deep Interview Spec: RAG V11 — 反馈闭环 + 企业就绪

## Metadata
- Interview ID: rag-v11-iteration-20260527
- Rounds: 3
- Final Ambiguity Score: 17.5%
- Type: brownfield
- Generated: 2026-05-27
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.90 | 35% | 0.315 |
| Constraint Clarity | 0.65 | 25% | 0.1625 |
| Success Criteria | 0.85 | 25% | 0.2125 |
| Context Clarity | 0.90 | 15% | 0.135 |
| **Total Clarity** | | | **0.825** |
| **Ambiguity** | | | **17.5%** |

## Goal

V11 聚焦两个方向共 6 个子功能：

**反馈闭环**：为每条 AI 回答添加赞/踩反馈按钮，存储反馈数据，在管理页提供反馈统计概览。

**企业就绪**：添加操作审计日志追踪关键操作、API Key 机制支持程序化访问、管理页使用统计仪表盘。

## Constraints

- 6 个子功能在同一迭代完成
- 不引入新基础设施（新增 3 张 DB 表，无新服务）
- 技术栈不变

## Non-Goals

- 不做 AI 回答自动优化（基于反馈数据的 RLHF 等）
- 不做审计日志高级搜索/导出（V11 仅记录+查看）
- 不做 API Key 权限范围限制（所有 Key 等同用户全权限）
- 不做日活趋势图表渲染（V11 用数字统计，不做图表）

## Acceptance Criteria

- [ ] **AC1 赞/踩按钮**：每条 assistant 消息下方显示 👍👎 按钮，点击记录反馈
- [ ] **AC2 切换反馈**：再次点击同一按钮取消反馈，切换按钮更新记录
- [ ] **AC3 反馈存储**：新建 `message_feedback` 表，字段 messageId/userId/rating/createdAt
- [ ] **AC4 反馈统计**：管理页新增"反馈概览"标签 — 总评分数、好评率、最近反馈列表（含消息内容摘要）
- [ ] **AC5 审计日志记录**：新建 `audit_logs` 表，记录操作类型/用户/资源/IP/时间
- [ ] **AC6 审计日志查看**：管理页新增"审计日志"标签，按时间倒序展示最近 200 条
- [ ] **AC7 API Key 生成**：用户设置页可生成/查看/吊销个人 API Key
- [ ] **AC8 API Key 鉴权**：`/api/kb/:id/chat` 支持 `Authorization: Bearer <api_key>` 头鉴权
- [ ] **AC9 使用概览**：管理页新增"使用概览"标签 — 总用户/总KB/总文档/总对话/今日提问数

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| "6个子功能一次迭代太大" | 是否拆分 | 用户确认全部都要，不拆分 |
| "API Key 改动范围最大" | 是否先跳过 | 用户确认不做权限范围限制，简化实现 |
| "需要图表渲染" | 统计可视化程度 | 确认 V11 仅数字统计，不做图表 |

## Technical Context

V1-V10 已交付：36 后端 + 30 前端文件，23 API 端点，8 DB 表。

### 反馈闭环实现要点
- **DB**：`message_feedback(messageId UUID PK, userId UUID, rating "up"|"down", createdAt, 联合唯一约束 messageId+userId)`
- **后端**：`POST /api/messages/:id/feedback { rating: "up"|"down" }` → upsert/delete toggle
- **后端**：`GET /api/admin/feedback-stats` → 总评分/好评率/最近列表
- **前端**：`MessageBubble.vue` 底部加 👍👎 按钮，assistant 消息自动显示
- **前端**：`AdminPage.vue` 新增"反馈概览"标签

### 审计日志实现要点
- **DB**：`audit_logs(id UUID PK, userId UUID, action VARCHAR, resource VARCHAR, resourceId VARCHAR, ip VARCHAR, createdAt)`
- **后端**：`src/lib/audit.ts` → `logAudit(userId, action, resource, resourceId, ip)` 工具函数
- **后端**：在现有路由的关键操作点（登录、创建/删除KB、上传/删除文档）插入 audit 调用
- **后端**：`GET /api/admin/audit-logs?limit=200` → 管理员查看
- **前端**：`AdminPage.vue` 新增"审计日志"标签

### API Key 实现要点
- **DB**：`api_keys(id UUID PK, userId UUID, key VARCHAR UNIQUE, name VARCHAR, lastUsedAt, createdAt, revokedAt)`
- **后端**：`POST /api/auth/api-keys` 生成 → `DELETE /api/auth/api-keys/:id` 吊销
- **后端**：`src/middleware/auth.ts` → `authenticateApiKey` 中间件，检查 `Authorization: Bearer <key>`
- **后端**：`/api/kb/:id/chat` 路由同时支持 JWT 和 API Key 鉴权
- **前端**：新增 `SettingsPage.vue` → API Key 管理界面（生成/查看/吊销）

### 使用概览实现要点
- **后端**：`GET /api/admin/overview` → 聚合查询（COUNT users/KBs/docs/conversations + 今日提问数）
- **前端**：`AdminPage.vue` 新增"使用概览"标签 → 数字卡片展示

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| MessageFeedback | new | id, messageId, userId, rating, createdAt | 属于 Message, 属于 User |
| AuditLog | new | id, userId, action, resource, resourceId, ip, createdAt | 属于 User |
| ApiKey | new | id, userId, key, name, lastUsedAt, createdAt, revokedAt | 属于 User |
| User | existing | id, username, role | 有多个 MessageFeedback, ApiKey, AuditLog |

## Ontology Convergence

| Round | Entity Count | New | Stable | Stability Ratio |
|-------|-------------|-----|--------|----------------|
| 1 | 2 (Feedback, AuditLog) | 2 | — | — |
| 2 | 5 (Feedback, AuditLog, ApiKey, Dashboard, StatsPanel) | 3 | 2 | 40% |
| 3 | 4 (MessageFeedback, AuditLog, ApiKey, User) | 0 | 4 | 100% |

## Interview Transcript

<details>
<summary>Full Q&A (3 rounds)</summary>

### Round 1
**Q:** V10 已完成引用高亮、文档预览、对话搜索。下一步最有价值的方向？
**A:** 2和3（反馈闭环 + 企业就绪），其它的先不动
**Ambiguity:** 59.75% (Goal: 0.50, Constraints: 0.20, Criteria: 0.20, Context: 0.85)

### Round 2
**Q:** 赞/踩 + 审计日志 + API Key + 统计面板，哪些是 V11 必须做的？
**A:** 全部都要
**Ambiguity:** 38.5% (Goal: 0.75, Constraints: 0.55, Criteria: 0.35, Context: 0.85)

### Round 3
**Q:** 六个功能的验收标准确认
**A:** 可以，就按这个
**Ambiguity:** 17.5% (Goal: 0.90, Constraints: 0.65, Criteria: 0.85, Context: 0.90)

</details>
