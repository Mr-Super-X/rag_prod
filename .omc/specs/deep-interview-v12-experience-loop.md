# Deep Interview Spec: V12 体验闭环

## Metadata
- Interview ID: v12-experience-loop
- Rounds: 6
- Final Ambiguity Score: 15.2%
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
| Context Clarity | 0.85 | 15% | 0.128 |
| **Total Clarity** | | | **0.848** |
| **Ambiguity** | | | **15.2%** |

## Goal
V12 聚焦"体验闭环"——让管理员和用户能感知系统运行状态和回答质量。一次性交付全部四个功能，全量深做。

## Constraints
- 一次性交付，统一验收
- 不改动核心 RAG 检索/生成链路
- 不引入新的 Docker 容器
- 预估 8-12 文件变更

## Non-Goals
- 不做 Cross-Encoder 精排替换
- 不做多模态文档解析
- 不做 RAGAS 自动评估框架
- 不新增 LLM Provider

## Acceptance Criteria

### 1. Admin 使用趋势图
- [ ] Admin 新增"使用趋势"标签
- [ ] 展示近 30 天每日提问量折线图（ECharts）
- [ ] 展示近 30 天每日活跃用户数折线图
- [ ] 可验证对比：图表能回答"上周三的提问量比本周三多还是少"

### 2. Admin 失败任务汇聚
- [ ] Admin 新增"失败任务"区域（可嵌入现有文档标签或独立标签）
- [ ] 列表展示 status=error 的文档：文件名、上传者、失败原因、时间
- [ ] 每条提供"重试"按钮，调用重试端点重新处理
- [ ] 可验证对比：管理员能说出"当前有 X 个失败文档，最近一个是 Y 因为 Z 原因"

### 3. 回答置信度指示
- [ ] 用户问答界面每条 AI 回答显示置信度标识
- [ ] 三级：高（绿色，Top-1 score ≥ 0.7）、中（黄色，0.4-0.7）、低（灰色，<0.4 或兜底）
- [ ] 基于 retrieval.service.ts RRF 融合后的 sources[0].score 计算
- [ ] 可验证对比：同一问题在文档充足和文档不足的知识库中，置信度标识不同

### 4. 文档分步进度
- [ ] 文档列表展示分步处理进度（解析 → 切分 → 向量化 → 索引 → 就绪）
- [ ] 当前步骤高亮/动画，已完成步骤打勾
- [ ] 前端通过轮询 documents.status 子状态或后端返回的 progress 字段驱动
- [ ] 可验证对比：上传文档后能看到进度从一个步骤移动到下一个步骤

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| UsageTrend | core | date, questionCount, activeUsers | derived from conversations + audit_logs aggregation |
| FailedTask | core | docId, filename, uploaderName, errorMessage, createdAt | belongs to Document; RetryAction → POST /api/kb/:id/docs/:docId/retry |
| ConfidenceBadge | supporting | level (high/medium/low), normalizedScore | attached to assistant Message in ChatPanel/MessageBubble |
| ProcessingStep | core | step (parsing/splitting/embedding/indexing/ready), startedAt, completedAt | belongs to Document; driven by processDocumentAsync pipeline stages |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 0 | - | - | - | N/A |
| 2 | 4 (Admin, User, 趋势图, 失败汇聚) | 4 | - | - | N/A |
| 3 | 4 (UsageTrend, FailedTask, ConfidenceBadge, ProcessingStep) | 4 | 0 | 0 | 0% |
| 4 | 4 (same) | 0 | 0 | 4 | 100% |
| 5 | 4 (same) | 0 | 0 | 4 | 100% |
| 6 | 4 (same, + details) | 0 | 0 | 4 | 100% |

> 从 R4 起本体完全收敛，4 个核心实体稳定，细节在 R5-R6 持续丰富。

## Technical Design

### 新增 API 端点
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/trends?days=30` | GET | 返回每日提问量+活跃用户数 |
| `/api/kb/:id/docs/:docId/retry` | POST | 重新处理失败文档 |
| `/api/kb/:id/docs/:docId/progress` | GET | 返回文档处理分步进度 |

### 修改文件清单（预估）
| 文件 | 变更 |
|------|------|
| `src/routes/admin.ts` | 新增 trends 端点 |
| `src/routes/doc.ts` | 新增 retry + progress 端点 |
| `src/services/doc.service.ts` | 扩展 processDocumentAsync 记录分步状态 |
| `src/db/schema.ts` | 可能新增 document_progress 表 |
| `src/services/chat.service.ts` | 置信度分数透传 |
| `client/src/pages/AdminPage.vue` | 新增趋势标签 + 失败任务区域 |
| `client/src/components/MessageBubble.vue` | 置信度标识渲染 |
| `client/src/components/DocList.vue` | 分步进度展示 |
| `client/src/lib/api.ts` | 可能新增 ECharts 或 chart 工具导入 |
| `client/src/components/ChatPanel.vue` | 置信度数据传递 |

### 数据来源
- **趋势图**: `conversations` 表按 `DATE(created_at)` 聚合 + `audit_logs` 按天去重 `user_id`
- **失败任务**: `documents` 表 `WHERE status = 'error'`，重试直接调用现有 `processDocumentAsync`
- **置信度**: `retrieval.service.ts` 的 RRF 融合后 `sources[0].score`，传入 chat.service 响应
- **分步进度**: 在 `processDocumentAsync` 各阶段写入进度状态（内存或 DB）

## Interview Transcript
<details>
<summary>Full Q&A (6 rounds)</summary>

### Round 1
**Q:** V12 迭代的核心目标？第一优先级？
**A:** 体验闭环优先
**Ambiguity:** 73.5%

### Round 2
**Q:** 四个具体痛点选 1-2 个
**A:** 全部四个
**Ambiguity:** 64.2%

### Round 3
**Q:** 四个的深度策略——薄层覆盖 vs 重点打磨 vs 全量深做？
**A:** 全量深做
**Ambiguity:** 55.8%

### Round 4 (Contrarian)
**Q:** 预估 8-12 文件变更，确认坚持全量深做？
**A:** 坚持全量深做
**Ambiguity:** 38.5%

### Round 5
**Q:** 完成标准——功能正确即可 vs 体验描述 vs 可验证对比？
**A:** 功能正确 + 可验证对比例
**Ambiguity:** 24.7%

### Round 6
**Q:** 一次性交付还是分步递进？
**A:** 一次性交付
**Ambiguity:** 15.2% ← 达标

</details>
