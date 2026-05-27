# Spec: RAG V8 — 管理员控制台 + 文档进度优化

## Metadata
- Spec ID: rag-v8-admin-console-20260527
- Status: completed
- Type: brownfield
- Version: V8

## Goal

为管理员提供用户和知识库管理能力，优化文档处理进度刷新速度。

## Scope

### 管理员控制台
- 新建 `/api/admin/*` 路由组，双重中间件保护（authenticate + requireAdmin）
- 用户列表查看和删除
- 知识库列表查看和强制删除（不检查权限）
- 前端 AdminPage 页面，仅 admin 角色可见

### 文档进度优化
- 轮询间隔从 3 秒缩短到 2 秒

## Acceptance Criteria
- [x] 管理员可查看所有用户列表
- [x] 管理员可删除任意用户
- [x] 管理员可查看所有知识库并强制删除
- [x] 非 admin 用户看不到管理入口
- [x] 文档进度刷新提速到 2 秒

## Technical Notes
- admin 路由直接调用 db，不经过 service 层权限校验（强制删除）
- AppLayout 导航栏通过 `isAdmin` computed 控制管理入口显隐
