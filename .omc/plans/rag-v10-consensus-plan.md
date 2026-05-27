# RAG V10 共识实现计划

## RALPLAN-DR 摘要

### 原则
1. 前端为主，后端轻量 — 3 个功能中 2.5 个是前端改动
2. 复用现有数据 — 不新增 DB 表
3. 最小破坏 — 改动限于目标组件
4. 混合策略 — prompt 为主 + 后处理兜底

### 决策驱动
1. 用户还没开始日常使用 → 产品打磨优先于后端优化
2. 7B 模型指令跟随不可靠 → 引用采用 prompt + 验证双保险
3. 独立开发者单迭代交付 → 8 个文件改动量可控

### 架构决策 (ADR)
- **决策**: 引用标注采用混合策略 — SYSTEM_PROMPT 要求 LLM 输出 [N] + 后端后处理验证/兜底
- **决策**: buildContext 统一为 `[N] filename\ncontent` 格式
- **决策**: 对话搜索仅标题，前端过滤，暂停轮询防闪烁
- **替代方案**: 纯后处理注入（被拒 — 关键词匹配无语义理解）；纯 prompt（被拒 — 7B 模型不可靠）

---

## 实现步骤

### Step 0: 统一 buildContext（前置）
- 文件: `src/services/chat.service.ts`
- 提取 `buildContext(sources: ChunkSource[]): string`
- 格式: `[1] filename\ncontent\n\n[2] filename\ncontent...`
- 替换: `ask()` L61, `streamAsk()` L125, 在 `routes/chat.ts` L47 调用

### Step 1: 引用高亮
**后端:**
- `src/pipeline/generator.ts`: SYSTEM_PROMPT 追加 "在回答中使用 [1] [2] 标注引用来源"
- `src/services/chat.service.ts`: 新增 `validateAndInjectCitations(answer, sources)` — 扫描 [N]，剥离无效标记，若无任何标记则做关键词重叠兜底注入
- `src/routes/chat.ts`: SSE 路径使用 buildContext() 替代内联 format

**前端:**
- `client/src/components/MessageBubble.vue`:
  - 新增 `parseContentToSegments(content)` — 正则 `/\[(\d{1,2})\]/g` 解析为 `{type, value}[]`
  - `v-text` → `v-for` 渲染 segments
  - 引用 span onClick → 展开 sources[value-1].content
  - 跳过 code block 内的 [N]

### Step 2: 文档预览
**后端:**
- `src/services/doc.service.ts`: 新增 `getDocPreview(docId, offset=0, limit=50)` — 查 chunks 表拼接
- `src/routes/doc.ts`: 新增 `GET /api/kb/:id/docs/:docId/preview` + requireKBAccess
- 后端守卫: status !== 'ready' → 400

**前端:**
- `client/src/components/DocPreviewModal.vue`: **新建** — Loading(spinner)/Error(重试)/Empty(无内容) 三态，ESC 关闭
- `client/src/components/DocList.vue`: 文档名 → button，点击设置 selectedDocId → 条件渲染 DocPreviewModal

### Step 3: 对话搜索
**前端 only:**
- `client/src/components/ConversationList.vue`:
  - 搜索框 + `searchKeyword` ref + 300ms debounce
  - computed 过滤: title 包含 keyword
  - 搜索时暂停 5s 轮询，清空恢复

---

## 文件清单

| # | 文件 | 操作 | 行数估计 |
|---|------|------|---------|
| 1 | `src/services/chat.service.ts` | 编辑 | +30 |
| 2 | `src/routes/chat.ts` | 编辑 | -5, +3 |
| 3 | `src/pipeline/generator.ts` | 编辑 | +2 |
| 4 | `src/services/doc.service.ts` | 编辑 | +20 |
| 5 | `src/routes/doc.ts` | 编辑 | +15 |
| 6 | `client/src/components/MessageBubble.vue` | 编辑 | +40 |
| 7 | `client/src/components/DocList.vue` | 编辑 | +10 |
| 8 | `client/src/components/DocPreviewModal.vue` | **新建** | ~80 |
| 9 | `client/src/components/ConversationList.vue` | 编辑 | +20 |

**合计**: 8 编辑 + 1 新建，约 +220 行，0 新依赖，0 新表

---

## 验收条件

- [ ] AC1: LLM 回答包含可点击引用编号 [1][2]
- [ ] AC2: 点击引用展开 sources 原文，再次点击收起
- [ ] AC3: 无效引用（N > sources.length）被自动剥离
- [ ] AC4: 文档名点击打开预览弹窗
- [ ] AC5: 弹窗支持按钮和 ESC 键关闭
- [ ] AC6: 处理中文档显示"文档处理中，暂不可预览"
- [ ] AC7: 对话列表顶部有搜索输入框
- [ ] AC8: 输入关键词实时过滤（300ms 防抖）
- [ ] AC9: 清除搜索框恢复完整列表
- [ ] AC10: buildContext 三处统一，无格式分歧
