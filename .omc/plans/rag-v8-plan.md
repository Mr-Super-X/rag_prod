# Plan: RAG V8 — 管理员控制台 + 文档进度优化

## Metadata
- Plan ID: rag-v8-admin-console-20260527
- Status: completed
- Version: V8

## Goal

添加管理员控制台，支持用户/KB 管理；优化文档进度轮询速度。

## Tasks

### 1. 管理员路由
- [x] `GET /api/admin/users` — 用户列表
- [x] `GET /api/admin/kbs` — 知识库列表
- [x] `DELETE /api/admin/users/:id` — 删除用户
- [x] `DELETE /api/admin/kbs/:id` — 强制删除 KB
- [x] `authenticate` + `requireAdmin` 双重中间件保护
- 文件：`src/routes/admin.ts`, `src/app.ts`

### 2. 管理员前端页面
- [x] `AdminPage.vue` — 用户管理 / KB 管理两个标签
- [x] 路由 `/admin`，仅 admin 角色可见
- [x] `AppLayout.vue` 导航栏显示管理入口（仅 admin）
- 文件：`client/src/pages/AdminPage.vue`, `client/src/router/index.ts`, `client/src/components/AppLayout.vue`

### 3. 文档进度优化
- [x] 轮询间隔从 3 秒缩短到 2 秒
- 文件：`client/src/components/DocList.vue`

## Technical Impact

| 指标 | Before | After |
|------|--------|-------|
| 后端源文件 | 34 | 36 (+admin route) |
| 前端源文件 | 28 | 29 (+AdminPage) |
| API 端点 | 18 | 22 (+4 admin) |
