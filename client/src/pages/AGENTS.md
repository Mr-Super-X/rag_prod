<!-- Parent: ../AGENTS.md -->

# pages

## Purpose

页面级 Vue 组件。每个文件对应一个路由，负责数据获取、业务编排和向子组件传递 props。

## Key Files

| File | Description |
|------|-------------|
| `LoginPage.vue` | 登录页面（用户名 + 密码 → 调 auth store login） |
| `RegisterPage.vue` | 注册页面 |
| `KBListPage.vue` | 知识库列表页（首页）：展示、创建、删除知识库 |
| `KBDetailPage.vue` | 知识库详情页：文档管理 + 对话面板 |

## For AI Agents

### Working In This Directory

- 页面组件负责调用 API 获取数据，子组件只收 props
- 使用 `useAsync` composable 管理异步状态
- 必须处理 loading/error/empty 三态

### Common Patterns

- 导入 `api` 从 `@/lib/api`
- 导入 store 从 `@/stores/xxx`
- 页面级数据通过 composable 或直接在组件内用 `useAsync` 获取
