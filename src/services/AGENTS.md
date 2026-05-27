<!-- Parent: ../AGENTS.md -->

# services

## Purpose

业务逻辑层。每个 service 负责一个领域，路由层调用 service 层，service 层调用 db/lib。

## Key Files

| File | Description |
|------|-------------|
| `auth.service.ts` | 认证：register（密码校验+hash+insert）、login（bcrypt 比较）、refresh token 生成/旋转/撤销、seedAdmin |
| `kb.service.ts` | 知识库 CRUD：list/create/get/update/delete，含权限校验（创建者或 admin） |
| `doc.service.ts` | 文档摄入：接收文件 → 创建记录 → 异步处理（parse→split→embed→store PG+LanceDB+BM25） |
| `retrieval.service.ts` | 混合检索：向量（LanceDB）+ BM25（Redis 倒排）→ RRF 融合 → 可选 reranker |
| `context.service.ts` | 对话管理：conversation CRUD + messages CRUD + 历史记录查询 |
| `chat.service.ts` | 问答编排：`ask()`（非流式）和 `streamAsk()`（SSE）——改写→检索→生成→保存 |

## Data Flow

```
chat.service.ask()
  ├── context.service.createConversation()
  ├── generator.rewriteQuestion()
  ├── context.service.addMessage(user)
  ├── retrieval.service.retrieve()
  │     ├── embedder.embedSingle()
  │     ├── vectordb.searchVectors()
  │     ├── bm25Search(Redis)
  │     └── reranker.rerank()
  ├── generator.generate()
  └── context.service.addMessage(assistant)
```

## For AI Agents

### Working In This Directory

- Service 函数签名第一个参数通常是操作对象 ID
- 权限校验放在 service 层（不在 route 层），通过比较 `userId` 和资源所有者
- 删除知识库时需同时清理 LanceDB 表（`dropTable`）和 PG 记录

### Common Patterns

- Drizzle 查询用 `db.select().from(table).where(eq(...))` 模式
- 错误抛出 `AppError` 子类，由全局 errorHandler 接管
- 异步处理文档时 `.catch(() => {})` 防止未处理的 rejection
