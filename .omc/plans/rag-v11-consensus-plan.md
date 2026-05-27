# RAG V11 共识实现计划

## RALPLAN-DR 摘要

### 原则
1. 数据先行 — 3 张新表先建 Drizzle schema + migrate
2. 安全第一 — API Key 存 hash（scrypt），明文仅返回一次
3. 最小侵入 — 审计日志 fire-and-forget，不阻塞业务
4. 独立可测 — 六个功能无相互依赖

### 决策驱动
1. 安全：API Key 必须 hash 存储，logger 遮盖 auth header
2. 兼容：API Key middleware 设置 request.user 结构与 JWT 一致
3. 性能：审计日志 fire-and-forget，不 await

### 架构决策 (ADR)
- **决策 1**：审计日志显式调用（非自动中间件）— 精确控制语义，避免噪音
- **决策 2**：API Key 用 scrypt hash — 业界标准，与 bcrypt 密码一致
- **决策 3**：反馈使用 upsert toggle — ON CONFLICT UPDATE 处理快速双击

### 替代方案
- 自动中间件审计 → 被拒：大量噪音（Swagger/health），无法区分读写
- API Key 明文存储 → 被拒：安全底线，不能存明文
- 反馈分离创建/删除端点 → 被拒：upsert 更简洁，前端无需追踪 feedbackId

---

## DB Schema

### message_feedback
```sql
id UUID PK DEFAULT gen_random_uuid()
messageId UUID FK → messages.id ON DELETE CASCADE
userId UUID FK → users.id
rating INTEGER NOT NULL CHECK (rating IN (-1, 1))
createdAt TIMESTAMPTZ DEFAULT now()
updatedAt TIMESTAMPTZ DEFAULT now()
UNIQUE(messageId, userId)
```

### audit_logs
```sql
id UUID PK DEFAULT gen_random_uuid()
userId UUID FK → users.id
action VARCHAR(50) NOT NULL
resource VARCHAR(50) NOT NULL
resourceId VARCHAR
ip VARCHAR(45)
createdAt TIMESTAMPTZ DEFAULT now()
INDEX idx_audit_user_id (userId)
INDEX idx_audit_created_at (createdAt)
```

### api_keys
```sql
id UUID PK DEFAULT gen_random_uuid()
userId UUID FK → users.id ON DELETE CASCADE
keyHash VARCHAR UNIQUE NOT NULL
keyPrefix VARCHAR(8) NOT NULL
name VARCHAR NOT NULL
lastUsedAt TIMESTAMPTZ
createdAt TIMESTAMPTZ DEFAULT now()
revokedAt TIMESTAMPTZ
INDEX idx_api_keys_hash (keyHash)
```

---

## 实现文件清单

| # | 文件 | 操作 | 描述 |
|---|------|------|------|
| 1 | `src/db/schema.ts` | 编辑 | 新增 3 张表定义 |
| 2 | `src/lib/audit.ts` | **新建** | `logAudit()` fire-and-forget |
| 3 | `src/routes/auth.ts` | 编辑 | login 处插入 audit + API Key CRUD |
| 4 | `src/routes/kb.ts` | 编辑 | createKB/deleteKB 处插入 audit |
| 5 | `src/routes/doc.ts` | 编辑 | uploadDoc/deleteDoc 处插入 audit |
| 6 | `src/routes/chat.ts` | 编辑 | 新增 POST feedback 端点 + API Key 兼容 |
| 7 | `src/routes/admin.ts` | 编辑 | 新增 stats/audit/feedback/dashboard 端点 |
| 8 | `src/middleware/auth.ts` | 编辑 | 新增 `authenticateApiKey` |
| 9 | `src/app.ts` | 编辑 | logger redact auth headers |
| 10 | `client/src/components/MessageBubble.vue` | 编辑 | 👍👎 按钮 |
| 11 | `client/src/pages/AdminPage.vue` | 编辑 | 新增 3 个标签 |
| 12 | `client/src/pages/SettingsPage.vue` | **新建** | API Key 管理 |
| 13 | `client/src/router/index.ts` | 编辑 | Settings 路由 |
| 14 | `client/src/components/AppLayout.vue` | 编辑 | 导航加设置入口 |
| 15 | `client/src/lib/api.ts` | 编辑 | feedback API 调用 |

**合计**：3 新建 + 12 编辑，3 张新表，0 新依赖

---

## 验收条件映射

- [ ] AC1 👍👎 按钮 → MessageBubble.vue
- [ ] AC2 切换反馈 → upsert toggle in POST endpoint
- [ ] AC3 反馈存储 → message_feedback 表
- [ ] AC4 反馈统计 → GET /api/admin/feedback-stats + AdminPage
- [ ] AC5 审计日志记录 → lib/audit.ts + 5 插入点
- [ ] AC6 审计日志查看 → GET /api/admin/audit-logs + AdminPage
- [ ] AC7 API Key 生成 → POST /api/auth/api-keys + SettingsPage
- [ ] AC8 API Key 鉴权 → authenticateApiKey + chat route OR logic
- [ ] AC9 使用概览 → GET /api/admin/overview + AdminPage
