# Deep Interview Spec: V13 AI 引擎配置统一

## Metadata
- Interview ID: v13-ai-engine
- Rounds: 5
- Final Ambiguity Score: 16.8%
- Type: brownfield
- Generated: 2026-05-29
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.95 | 35% | 0.333 |
| Constraint Clarity | 0.75 | 25% | 0.188 |
| Success Criteria | 0.80 | 25% | 0.200 |
| Context Clarity | 0.75 | 15% | 0.113 |
| **Total Clarity** | | | **0.832** |
| **Ambiguity** | | | **16.8%** |

## Goal
V13 — AI 引擎配置统一面板。在 Admin 控制台新增"AI 引擎"标签，统一管理 Embedding 模型和 LLM Provider 的切换，支持向量全量/增量迁移，迁移过程安全可回滚、进度可观测。

## Constraints
- 三者合一：Embedding 热切换 + LLM Provider 切换 + 向量迁移工具
- 不新增 Docker 容器/Ollama 模型（切换仅在已有模型间进行）
- 预估 8-10 文件变更
- 迁移期间知识库可查询（向量库只读模式）

## Non-Goals
- 不引入新的 Embedding provider（如 OpenAI Embeddings API）
- 不做 RAGAS 自动评估框架
- 不改变现有检索/生成核心链路

## Acceptance Criteria

### 1. Embedding 模型热切换
- [ ] Admin "AI 引擎"标签支持从 Ollama 已安装模型列表中选择 Embedding 模型
- [ ] 切换时自动检测维度变化（1024→768/1792/...），提示管理员确认
- [ ] 维度变化时触发全量向量重建；维度不变时跳过重建
- [ ] 切换后同一问题 Top-5 检索结果可与切换前对比（结果集保存到临时文件/DB）

### 2. LLM Provider 切换 UI
- [ ] Admin 面板支持选择 LLM Provider（ollama/deepseek）+ 对应模型名
- [ ] 切换后即时生效（无需重启后端），通过 config 热更新或运行时切换
- [ ] DeepSeek API Key 在 UI 中配置（masked 展示，不存明文于前端）

### 3. 向量迁移工具
- [ ] 迁移进度实时展示（x/n chunks，百分比，预估剩余时间）
- [ ] 迁移失败自动回滚到旧向量（旧 LanceDB 表保留至新表确认就绪）
- [ ] 迁移前后 chunk 数一致验证
- [ ] 迁移耗时统计与展示

### 4. 性能基线
- [ ] 切换前后同一问题端到端延迟对比（embedding + retrieval + generation）
- [ ] 问答准确率基准测试（至少 5 个预设问题，切换前后结果对比）

## Technical Context
- Embedding: `src/pipeline/embedder.ts` → Ollama `/api/embed`，当前 BGE-M3 1024 维
- 向量库: `src/lib/vectordb.ts` → LanceDB，表名 `kb_{kbId}`
- LLM: `src/pipeline/generator.ts` → `LLM_PROVIDER` env + Ollama/DeepSeek factory
- 配置: `src/config.ts` → Zod schema，当前运行时不可热更新
- Admin: `client/src/pages/AdminPage.vue` → 5 标签（V12 新增 2 个 = 7 个）

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| AIConfig | core | embeddingModel, llmProvider, llmModel, deepseekApiKey | persisted to config/env |
| MigrationJob | core | kbId, totalChunks, completedChunks, status, startedAt, oldTable, newTable | operates on LanceDB |
| ModelInfo | supporting | name, dimensions, provider | from Ollama /list API |
| BenchmarkResult | supporting | question, oldAnswer, newAnswer, oldLatency, newLatency | derived from chat.service |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 0 | - | - | - | N/A |
| 2 | 3 (EmbeddingModel, LLMProvider, VectorMigration) | 3 | - | - | N/A |
| 3 | 3 (same) | 0 | 0 | 3 | 100% |
| 4 | 3 (same) | 0 | 0 | 3 | 100% |
| 5 | 4 (AIConfig, MigrationJob, ModelInfo, BenchmarkResult) | 4 | 0 | 0 | 0% |

> 本体从自然语言描述转为代码级抽象，最后一轮实体名称精化。

## Interview Transcript
<details>
<summary>Full Q&A (5 rounds)</summary>

### Round 1
**Q:** V13 核心方向？
**A:** 工程基础优先
**Ambiguity:** 72.8%

### Round 2
**Q:** 工程基础范围？
**A:** 热切换 + 迁移工具 + LLM切换统一
**Ambiguity:** 57.0%

### Round 3
**Q:** 成功标准？
**A:** 切换+安全+可观测
**Ambiguity:** 35.5%

### Round 4 (Contrarian)
**Q:** 三者合一确认？
**A:** 坚持三者合一
**Ambiguity:** 27.3%

### Round 5
**Q:** 验收粒度？
**A:** 功能+一致性+性能基线
**Ambiguity:** 16.8% ← 达标

</details>
