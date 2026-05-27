<!-- Parent: ../AGENTS.md -->

# pipeline

## Purpose

`src/pipeline/` 处理流水线的单元测试。

## Key Files

| File | Description |
|------|-------------|
| `splitter.test.ts` | 文本切分：chunk 大小、重叠、段落边界 |
| `embedder.test.ts` | Embedding 调用：批次、超时、错误处理 |
| `generator.test.ts` | LLM 生成：system prompt、流式、上下文改写 |
| `reranker.test.ts` | 精排：候选池输入输出、降级行为 |
| `agent.test.ts` | Agent 意图检测：时间查询、计算器 |

## For AI Agents

- 嵌入和生成测试 mock `fetch` 调用，不依赖 Ollama
- 切分测试纯函数，无需 mock
- Agent 测试验证函数名和参数提取的正确性
