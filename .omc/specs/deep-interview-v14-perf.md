# Deep Interview Spec: V14 性能优化

## Metadata
- Interview ID: v14-perf
- Rounds: 4
- Final Ambiguity Score: 14.8%
- Type: brownfield
- Generated: 2026-06-01
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.95 | 35% | 0.333 |
| Constraint Clarity | 0.80 | 25% | 0.200 |
| Success Criteria | 0.80 | 25% | 0.200 |
| Context Clarity | 0.80 | 15% | 0.120 |
| **Total Clarity** | | | **0.853** |
| **Ambiguity** | | | **14.8%** |

## Goal
V14 — 性能优化双引擎。Cross-Encoder 精排替换 LLM listwise（延迟 ~3s→~50ms），Redis 查询缓存（重复提问秒回零成本）。

## Constraints
- 不新增 Docker 容器（BGE-Reranker 通过 Ollama 部署）
- 不改动检索/生成核心链路
- 不改前端 UI（可新增 Admin 可观测面板）
- 不改 DB schema

## Non-Goals
- 不做 Agent 工具扩展
- 不做反馈回流检索
- 不做 HyDE 查询改写

## Acceptance Criteria

### 1. Cross-Encoder 精排
- [ ] `reranker.ts` 新增 BGE-Reranker-v2-m3 调用路径（Ollama `/api/chat` 评分模式）
- [ ] 保留原 LLM listwise 路径作为 fallback（`RERANKER_ENABLED` 开关控制）
- [ ] 5 个预设问题精排延迟 < 200ms（当前 ~3s）
- [ ] 精排 Top-5 结果与 LLM listwise 结果一致性 ≥ 60%（人工评估或 Jaccard 相似度）

### 2. Redis 查询缓存
- [ ] 缓存维度：`kbId + question(归一化后) + embeddingModel` → `{ answer, sources, timestamp }`
- [ ] TTL: 24 小时（文档更新时相关 KB 缓存主动失效）
- [ ] 缓存命中时跳过 embedding+retrieve+generate 全链路
- [ ] Admin 面板显示缓存命中率（今日本日/总计）

### 3. 可观测性
- [ ] Admin "性能"标签：缓存命中率 + Reranker 选型名 + 平均延迟
- [ ] 切换前后基准对比：保存切换前的延迟数据，切换后可对比

### 4. 性能基线
- [ ] 5 个预设问题切换前后延迟对比（P50/P95）
- [ ] 缓存命中率 > 30% 为合格（企业场景重复提问占比高）

## Technical Context
- Reranker: `src/pipeline/reranker.ts` — 当前 LLM listwise，接口 `rerank(query, candidates[])`
- Redis: `src/lib/redis.ts` — ioredis，已用于 BM25，新增 KV 缓存
- Cache key: `${kbId}:cache:${hash(question+model)}` → TTL 86400
- Cache invalidation: 文档上传/删除时清理 `kbId:*` 缓存

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| CrossEncoderReranker | core | modelName, latencyMs | replaces LLM listwise in reranker.ts |
| QueryCache | core | cacheKey, answer, sources, createdAt, ttl | stored in Redis, invalidated on doc change |
| PerformanceMetrics | supporting | cacheHitRate, rerankerLatency, totalLatency | displayed in Admin panel |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 0 | - | - | - | N/A |
| 2 | 3 (CrossEncoder, RedisCache, LatencyBenchmark) | 3 | - | - | N/A |
| 3 | 3 (same) | 0 | 0 | 3 | 100% |
| 4 | 3 (CrossEncoderReranker, QueryCache, PerformanceMetrics) | 3 | 0 | 0 | 0% |

## Interview Transcript
<details>
<summary>Full Q&A (4 rounds)</summary>

### Round 1
**Q:** V14 核心方向？
**A:** 性能成本优先 + 产品体验优先
**Ambiguity:** 65.8%

### Round 2
**Q:** 四选二核心组合？
**A:** 精排 + 缓存
**Ambiguity:** 45.3%

### Round 3
**Q:** 验证粒度？
**A:** 功能+可观测+基准线
**Ambiguity:** 24.8%

### Round 4 (Contrarian)
**Q:** 只做缓存，不做精排？
**A:** 坚持两个都做
**Ambiguity:** 14.8% ← 达标

</details>
