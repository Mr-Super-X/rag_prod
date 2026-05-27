# Plan: RAG V4 — 安全与体验增强

## Metadata
- Plan ID: rag-v4-enhancement-20260526
- Status: completed
- Version: V4

## Goal

为 RAG 知识库平台添加安全防护和用户体验增强：速率限制、多租户数据隔离、文档进度轮询、思考过程动画。

## Tasks

### 1. 速率限制
- [x] 安装 `@fastify/rate-limit`，全局 60 req/min
- [x] 超标返回 429 Too Many Requests
- 文件：`src/app.ts`

### 2. 多租户 KB 访问控制
- [x] 新建 `kb_members` 表（id, kbId, userId, role）
- [x] `requireKBAccess` 中间件：先查 createdBy，再查 kb_members
- [x] KB 创建者自动成为 owner 成员
- [x] 非成员访问返回 403
- 文件：`src/db/schema.ts`, `src/middleware/auth.ts`, `src/services/kb.service.ts`

### 3. 文档进度轮询
- [x] 有处理中文档时每 3 秒自动刷新列表
- [x] 全部就绪后自动停止轮询
- [x] `onUnmounted` 清理定时器
- 文件：`client/src/components/DocList.vue`

### 4. 思考过程动画
- [x] 发送问题后显示"检索中..."脉冲动画
- [x] 首 token 到达后自动消失
- [x] CSS `@keyframes pulse`
- 文件：`client/src/components/ChatPanel.vue`

## Technical Impact

| 指标 | Before | After |
|------|--------|-------|
| 后端源文件 | 33 | 33 |
| 数据库表 | 7 | 8 (+kb_members) |
| API 端点 | 15 | 15 |
