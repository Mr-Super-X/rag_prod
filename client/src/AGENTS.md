<!-- Parent: ../AGENTS.md -->

# client/src

## Purpose

Vue 3 前端源码根目录。包含页面、组件、状态管理、路由、API 客户端和可组合函数。

## Key Files

| File | Description |
|------|-------------|
| `main.ts` | Vue 应用入口：createApp → use(pinia) → use(router) → mount |
| `App.vue` | 根组件，包含 `<router-view>` 和全局布局 |
| `types.ts` | 前端共享类型：UserInfo, KnowledgeBase, Document, Message, Conversation, ApiResponse |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `components/` | 可复用 UI 组件 |
| `composables/` | Vue 可组合函数（useAsync） |
| `lib/` | API 客户端封装 |
| `pages/` | 页面级组件（路由目标） |
| `router/` | Vue Router 配置 |
| `stores/` | Pinia 状态管理 |

## For AI Agents

### Working In This Directory

- `<script setup lang="ts">` 是组件标准写法
- 路径别名 `@/` 映射到 `src/`
- 异步组件必须处理 Loading/Error/Empty 三态
- API 调用一律经 `lib/api.ts`，不直接 fetch

### Common Patterns

- Props 用 `defineProps<T>()` 纯类型语法
- Pinia Setup Store 模式
- 页面路由懒加载：`() => import("@/pages/Xxx.vue")`
