<!-- Parent: ../AGENTS.md -->

# stores

## Purpose

Pinia 状态管理。管理全局用户认证状态。

## Key Files

| File | Description |
|------|-------------|
| `auth.ts` | 认证 Store：`user`, `isLoggedIn`, `isAdmin` + `login/register/logout` actions |

## For AI Agents

### Working In This Directory

- Setup Store 模式（`defineStore("name", () => { ... })`）
- 一个 Store 只管理一个领域，不超过 200 行
- 状态下推：能用组件内 ref 解决的不用 store

### Common Patterns

- `login()` 同时设置 accessToken（内存）、refreshToken（localStorage）、user（localStorage）
- `logout()` 清理全部三个
- 页面刷新后从 localStorage 恢复 user 信息
