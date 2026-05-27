<!-- Parent: ../AGENTS.md -->

# services

## Purpose

`src/services/` 服务层的单元测试。

## Key Files

| File | Description |
|------|-------------|
| `auth.service.test.ts` | 密码校验、bcrypt、token 生成 |
| `kb.service.test.ts` | KB CRUD 权限逻辑 |
| `context.service.test.ts` | 对话管理纯逻辑 |
| `chat.service.test.ts` | 问答编排流程（mock 检索和生成） |

## For AI Agents

- 使用 `vi.mock()` mock DB 调用和外部 API
- 测试业务逻辑而非数据库操作（数据库操作在 `test/` 集成测试中覆盖）
