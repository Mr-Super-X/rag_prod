<!-- Parent: ../AGENTS.md -->

# client

## Purpose

Vue 3 前端应用。知识库管理界面，支持文档上传、对话列表、SSE 流式问答、用户认证。
独立 `package.json`，Vite 开发服务器端口 5173，API 请求代理到后端 3000。

## Key Files

| File | Description |
|------|-------------|
| `package.json` | 独立依赖：Vue 3 + Pinia + Vue Router + Vite |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | 前端源码（组件、页面、状态管理、路由） |
| `public/` | 静态资源目录 |

## For AI Agents

### Working In This Directory

- 必须 `cd client` 后才能执行 `npm install` 或 `npm run dev`
- 前端有独立的 TypeScript 配置和构建流程
- API 调用必须走 `src/lib/api.ts` 封装的 `api` 对象，不要直接用 fetch

### Common Patterns

- Vue 3 `<script setup>` + TypeScript
- Pinia 状态管理（Setup Store 模式），一个 store 一个领域
- 页面路由懒加载：`() => import("@/pages/Xxx.vue")`
- composable 提取可复用逻辑，`hooks/` 目录目前为空

## Dependencies

### External

- `vue` 3.5 — 框架
- `vue-router` 4 — 路由
- `pinia` 2 — 状态管理
- `vite` 6 — 构建工具
