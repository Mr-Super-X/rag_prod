<!-- Parent: ../AGENTS.md -->

# lib

## Purpose

基础设施封装。提供数据库、向量库、缓存和错误处理的统一接口。

## Key Files

| File | Description |
|------|-------------|
| `vectordb.ts` | LanceDB 封装：`insertVectors`, `searchVectors`, `deleteVectors`, `dropTable`, `kbTableName` |
| `redis.ts` | Redis 客户端（ioredis，lazy connect） |
| `errors.ts` | 错误类层级：`AppError` → `NotFoundError`, `UnauthorizedError`, `ForbiddenError` + 全局 errorHandler |

## For AI Agents

### Working In This Directory

- `vectordb.ts` 中 LanceDB 表名规则：`kb_<uuid>`（短横线替换为下划线）
- `searchVectors()` 返回的 score 做了转换：`1 - _distance`（距离→相似度）
- `errors.ts` 的 errorHandler 是全局的，新增错误类型在此定义

### Common Patterns

- LanceDB 是嵌入式向量库，不需要单独的服务进程
- Redis 使用 `lazyConnect: true`，服务启动时在 `app.ts` 中显式 connect
