<!-- Parent: ../AGENTS.md -->

# __tests__

## Purpose

后端单元测试。与 `test/`（集成测试）互补，覆盖独立可测的纯函数和模块逻辑。Vitest 框架，无需数据库或外部服务。

## Key Files

| File | Description |
|------|-------------|
| `config.test.ts` | 环境变量加载和 Zod 校验测试 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `lib/` | 错误类、工具函数单元测试 |
| `middleware/` | 认证中间件单元测试 |
| `pipeline/` | 文档处理、嵌入、生成、精排单元测试 |
| `services/` | 服务层纯逻辑单元测试 |

## For AI Agents

### Working In This Directory

- 单元测试不依赖 PG/Redis/Ollama，mock 外部依赖
- 新增纯函数的测试应放在此处而非 `test/`（`test/` 是集成测试）
- 测试文件命名为 `模块名.test.ts`

### Testing Requirements

- 覆盖边界条件和错误路径
- 每个测试文件独立运行，不依赖顺序

### Common Patterns

- AAA 模式：Arrange → Act → Assert
- 使用 `vi.mock()` 模拟外部模块

## Dependencies

### Internal

- 被测模块在 `src/lib/`、`src/middleware/`、`src/pipeline/`、`src/services/`

### External

- `vitest` 3 — 测试运行器
