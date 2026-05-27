<!-- Parent: ../AGENTS.md -->

# composables

## Purpose

Vue 3 可组合函数（Composables），封装可复用的响应式逻辑。

## Key Files

| File | Description |
|------|-------------|
| `useAsync.ts` | 通用异步操作封装：返回 `{ data, loading, error, execute }`，自动管理 loading/error 状态 |

## For AI Agents

### Working In This Directory

- 一个 composable 只导出一个函数，职责单一
- Composable 不超过 80 行
- 命名以 `use` 开头

### Common Patterns

- 返回 `ref` / `computed` 供组件绑定
- 异步操作在 composable 内处理错误，调用方不需要 try-catch
