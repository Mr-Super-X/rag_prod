<!-- Parent: ../AGENTS.md -->

# router

## Purpose

Vue Router 配置。定义应用路由和导航守卫。

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | 4 条路由定义 + beforeEach 守卫（鉴权检查） |

## Routes

| Path | Name | Page | Auth |
|------|------|------|------|
| `/login` | login | LoginPage | 否 |
| `/register` | register | RegisterPage | 否 |
| `/` | kb-list | KBListPage | 是 |
| `/kb/:id` | kb-detail | KBDetailPage | 是 |

## For AI Agents

### Working In This Directory

- 新增需要认证的页面 → 加 `meta: { requiresAuth: true }`
- 页面路由用懒加载：`() => import("@/pages/Xxx.vue")`
- 导航守卫通过 localStorage 中是否有 `refreshToken` 判断登录态

### Common Patterns

- 已登录用户访问 `/login` 自动跳 `/`
- 未登录用户访问需认证页面自动跳 `/login`
