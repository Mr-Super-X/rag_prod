# Plan: RAG V9 — 对话导出 + 管理员增强

## Metadata
- Plan ID: rag-v9-export-stats-20260527
- Status: completed
- Version: V9

## Goal

支持对话导出为 Markdown，为管理员面板添加 KB 使用统计。

## Tasks

### 1. 对话导出
- [x] `GET /api/conversations/:id/export` — 返回 Markdown 格式文本
- [x] 前端 `ConversationList.vue` 添加导出按钮 → 触发下载 `.md` 文件
- 文件：`src/routes/chat.ts`, `client/src/components/ConversationList.vue`

### 2. KB 使用统计
- [x] `GET /api/admin/kbs` 增强：返回每个 KB 的文档数和对话数
- [x] `AdminPage.vue` KB 管理标签显示统计列
- 文件：`src/routes/admin.ts`, `client/src/pages/AdminPage.vue`

## Technical Impact

| 指标 | Before | After |
|------|--------|-------|
| 后端源文件 | 36 | 36 |
| 前端源文件 | 29 | 29 |
| API 端点 | 22 | 22 |
