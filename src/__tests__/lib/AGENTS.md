<!-- Parent: ../AGENTS.md -->

# lib

## Purpose

`src/lib/` 模块的单元测试。

## Key Files

| File | Description |
|------|-------------|
| `errors.test.ts` | AppError / NotFoundError / errorHandler 测试 |

## For AI Agents

- mock 外部依赖，仅测试纯逻辑
- 错误类测试覆盖：构造、状态码、errorCode、统一错误处理器行为
