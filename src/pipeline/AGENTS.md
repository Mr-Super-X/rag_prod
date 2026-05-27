<!-- Parent: ../AGENTS.md -->

# pipeline

## Purpose

文档处理流水线和 LLM 交互层。解析→切分→嵌入→生成→重排，每个步骤是独立模块。

## Key Files

| File | Description |
|------|-------------|
| `parser.ts` | 文件解析：支持 PDF（pdf-parse）/ Word（mammoth）/ MD / TXT |
| `splitter.ts` | 文本切分：按段落切分，chunk_size=500, overlap=50 |
| `embedder.ts` | Ollama Embedding 调用：BGE-m3，批次 5 条，5 分钟超时 |
| `generator.ts` | LLM 生成：Qwen2.5-7B chat（含 system prompt）+ SSE 流式 + 上下文改写 |
| `reranker.ts` | 降级精排：用 LLM 对候选片段逐条打 0-1 相关性分 |

## Data Flow

```
Document Ingestion:
  parser.parseFile() → splitter.splitText() → embedder.embed() → store in LanceDB + PG + BM25(Redis)

Question Answering:
  embedder.embedSingle(query) → LanceDB vector search + BM25 search
  → RRF fusion → reranker.rerank() (optional) → generator.generate()
```

## For AI Agents

### Working In This Directory

- `generator.ts` 的 system prompt 定义了回答行为准则，修改时注意保持中文
- `rewriteQuestion()` 失败会静默降级返回原始问题
- `reranker` 默认关闭（`RERANKER_ENABLED=false`），开启后每片段调一次 LLM，很慢
- 所有 Ollama 请求都是 HTTP fetch，不依赖 SDK

### Common Patterns

- 嵌入批次大小 5（`embedder.ts:52`），避免 Ollama 超时
- 动态 import 重型包（pdf-parse, mammoth, @node-rs/jieba）来避免启动时加载
- 温度参数：生成 0.3，改写 0.1，重排 0
