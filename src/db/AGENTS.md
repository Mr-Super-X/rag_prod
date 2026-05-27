<!-- Parent: ../AGENTS.md -->

# db

## Purpose

数据库层。Drizzle ORM schema 定义、连接管理、迁移文件。

## Key Files

| File | Description |
|------|-------------|
| `schema.ts` | 7 张表定义：users, knowledge_bases, documents, chunks, conversations, messages, refresh_tokens |
| `index.ts` | 创建 Drizzle 连接池（postgres-js, max=10）并导出 `db` + `schema` |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `migrations/` | Drizzle Kit 生成的 SQL 迁移文件 |

## Table Relationships

```
users 1──N knowledge_bases (created_by)
users 1──N documents (uploaded_by)
users 1──N conversations (user_id)
users 1──N refresh_tokens (user_id)
knowledge_bases 1──N documents → CASCADE delete
knowledge_bases 1──N chunks → CASCADE delete
documents 1──N chunks → CASCADE delete
conversations 1──N messages → CASCADE delete
```

## For AI Agents

### Working In This Directory

- 修改 `schema.ts` 后必须：`npx drizzle-kit generate` → `npx drizzle-kit migrate`
- 新增表参考现有模式：`pgTable()` + index + 外键引用
- 不要手动编辑 `migrations/` 目录下的文件，由 drizzle-kit 生成

### Common Patterns

- 所有 ID 用 UUID `defaultRandom().primaryKey()`
- 时间戳用 `timestamp("xxx", { withTimezone: true }).defaultNow()`
- 索引用第三个参数 `(t) => [index("idx_xxx").on(t.col)]`
