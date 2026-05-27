# Deep Interview Spec: RAG V10 — 产品体验打磨

## Metadata
- Interview ID: rag-v10-iteration-20260527
- Rounds: 6
- Final Ambiguity Score: 16.25%
- Type: brownfield
- Generated: 2026-05-27
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.90 | 35% | 0.315 |
| Constraint Clarity | 0.70 | 25% | 0.175 |
| Success Criteria | 0.85 | 25% | 0.2125 |
| Context Clarity | 0.90 | 15% | 0.135 |
| **Total Clarity** | | | **0.8375** |
| **Ambiguity** | | | **16.25%** |

## Goal

让 RAG 平台达到可日常使用的体验水平，解决三个核心使用阻碍：

1. **引用高亮**：答案中插入可点击的引用编号，点击展开来源原文片段
2. **文档预览**：文档列表点击弹窗展示已解析的完整文本
3. **对话搜索**：对话历史侧边栏关键词实时过滤

## Constraints

- 不引入新的基础设施（无需新的 Docker 服务或数据库）
- 三个功能在同一迭代中完成
- 技术栈不变：后端 Fastify + TypeScript，前端 Vue 3
- 尽量复用现有数据和 API，减少后端改动

## Non-Goals

- 不在答案中做 inline 高亮标注（仅引用编号 + 展开模式）
- 不做文档格式渲染（纯文本预览即可）
- 不做全文语义搜索（仅标题关键词过滤）
- 不做图片/多模态支持
- 不引入新的 LLM 或 Embedding 模型

## Acceptance Criteria

- [ ] **引用高亮 AC1**：LLM 回答中自动包含引用编号 `[1]` `[2]` 等，对应 sources 数组索引
- [ ] **引用高亮 AC2**：点击引用编号在消息下方展开/收起对应 chunk 的原文片段
- [ ] **引用高亮 AC3**：引用编号可重复点击切换展开状态
- [ ] **文档预览 AC1**：文档列表中点击文档名打开弹窗，展示完整解析文本
- [ ] **文档预览 AC2**：弹窗有关闭按钮和 ESC 键关闭
- [ ] **文档预览 AC3**：处理中文档状态显示"文档处理中，暂不可预览"
- [ ] **对话搜索 AC1**：对话历史列表顶部显示搜索输入框
- [ ] **对话搜索 AC2**：输入关键词后实时过滤（前端过滤，300ms 防抖）
- [ ] **对话搜索 AC3**：清除搜索框恢复完整列表

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| "所有方向都有价值" | 作为独立开发者必须取舍 | 基于"还没人用"的事实，聚焦产品打磨而非后端优化 |
| "三个功能可以一次做完" | 技术复杂度是否可控 | 三个功能以前端为主，后端改动量小，一个迭代可行 |
| "文档预览需要新存储" | 能否从已有的 chunks 表拼接 | 采用 chunks 表按 chunk_index 排序拼接，无需新增存储 |

## Technical Context

基于 V1-V9 已交付的 65 个源文件（39 后端 + 26 前端）。

### 引用高亮实现要点
- **后端改动**：`src/pipeline/generator.ts` 的 prompt 中要求 LLM 在答案中用 `[1]` `[2]` 标注引用
- **后端改动**：`src/routes/chat.ts` 的 SSE 流中传递 sources 数组（已实现）
- **前端改动**：`MessageBubble.vue` 解析答案中的 `[N]` 标记，渲染为可点击按钮
- **前端改动**：点击引用编号时在 `MessageBubble.vue` 下方展开 sources[N].content

### 文档预览实现要点
- **后端改动**：`src/routes/doc.ts` 新增 `GET /api/kb/:id/docs/:docId/preview` 端点
- **后端改动**：`src/services/doc.service.ts` 新增 `getDocPreview()` — 从 chunks 表按 `chunk_index` 排序拼接文本
- **前端改动**：`DocList.vue` 文档名改为可点击按钮
- **前端改动**：新建 `DocPreviewModal.vue` 弹窗组件（Loading/Error/Empty 三态）

### 对话搜索实现要点
- **前端改动**：`ConversationList.vue` 顶部加搜索框
- 前端过滤：`computed` 过滤 `convs.data.value`，标题匹配关键词（防抖 300ms）
- 无需后端改动

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Message | core domain | id, content, role, sources, createdAt | Message 属于 Conversation |
| ChunkSource | supporting | chunkId, docId, docName, content, score | ChunkSource 属于 Message 的 sources 数组 |
| Document | core domain | id, name, status, kbId | Document 有多个 Chunk |
| Conversation | core domain | id, title, kbId, updatedAt | Conversation 有多个 Message |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 3 (Message, ChunkSource, Citation) | 3 | - | - | - |
| 2 | 4 (Message, ChunkSource, Document, PreviewModal) | 2 | 0 | 2 | 50% |
| 3 | 4 (Message, ChunkSource, Document, ConversationSearch) | 1 | 0 | 3 | 75% |
| 4 | 4 (Message, Source, Document, Conversation) | 0 | 1 | 3 | 100% |
| 5 | 4 (Message, Source, Document, Conversation) | 0 | 0 | 4 | 100% |
| 6 | 4 (Message, ChunkSource, Document, Conversation) | 0 | 0 | 4 | 100% |

## Interview Transcript

<details>
<summary>Full Q&A (6 rounds)</summary>

### Round 1
**Q:** V1-V9 已经覆盖了完整的 RAG 核心链路。你觉得当前平台最让你"不够满意"的方面是什么？
**A:** 我还没想好（需要帮助分析）
**Ambiguity:** 77.5% (Goal: 0.20, Constraints: 0.10, Criteria: 0.10, Context: 0.70)

### Round 2
**Q:** 6 个方向中，哪一个对"当前最有价值"？
**A:** 都有价值
**Ambiguity:** 75% (Goal: 0.25, Constraints: 0.10, Criteria: 0.10, Context: 0.75)

### Round 3
**Q:** 当前平台你自己或团队有人在日常使用吗？
**A:** 还没开始用
**Ambiguity:** 68.75% (Goal: 0.30, Constraints: 0.20, Criteria: 0.15, Context: 0.80)

### Round 4
**Q:** 现在打开这个平台，有什么地方让你觉得"还差点意思，不想用"？
**A:** 1（答案可信度）、2（文档不可见）、3（对话管理弱）
**Ambiguity:** 45.75% (Goal: 0.65, Constraints: 0.35, Criteria: 0.40, Context: 0.85)

### Round 5
**Q:** 三个功能放在一个迭代还是拆开？
**A:** 一个迭代全做
**Ambiguity:** 27.5% (Goal: 0.85, Constraints: 0.65, Criteria: 0.55, Context: 0.85)

### Round 6
**Q:** 验收标准确认：引用高亮（可点击编号+展开原文）、文档预览（弹窗展示解析文本）、对话搜索（关键词过滤标题）
**A:** 可以，就按这个
**Ambiguity:** 16.25% (Goal: 0.90, Constraints: 0.70, Criteria: 0.85, Context: 0.90)

</details>
