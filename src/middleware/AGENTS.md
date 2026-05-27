<!-- Parent: ../AGENTS.md -->

# middleware

## Purpose

Fastify 中间件。请求处理前的拦截逻辑。

## Key Files

| File | Description |
|------|-------------|
| `auth.ts` | JWT 认证中间件：`authenticate`（验证 token，401）+ `requireAdmin`（检查 admin 角色，403） |

## For AI Agents

### Working In This Directory

- `authenticate` 通过 `app.addHook("onRequest", authenticate)` 挂载到需要认证的路由组
- `requireAdmin` 作为独立 hook 使用，不替代 authenticate
- JWT payload 类型声明在 `@fastify/jwt` 的 module augmentation 中

### Common Patterns

- 中间件返回 `{ success: false, error: { code, message } }` 格式
