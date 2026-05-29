# V12 体验闭环 — 共识执行计划

## RALPLAN-DR

### Principles
1. 最小侵入 — 不碰检索/生成/嵌入核心链路
2. 最小表变更 — 仅 documents 表加 1 个 progress_step 列
3. 向后兼容 — 新 API 为增量端点
4. 单一新依赖 — 仅 echarts（按需引入）
5. 降级优雅 — 无数据时返回空数组

### Decision: 置信度信号源
**选: vectorScore（向量余弦相似度）** — RRF 融合分是排序分非相关度分，改用 LanceDB 原始 `_distance` 转 `1 - distance` 透传，前端对 vectorScore 做三色判断（<0.4 低 / 0.4-0.7 中 / >0.7 高）

### Decision: retry 幂等
**选: 乐观锁 + 先删后建** — retry 入口检查 status !== 'processing' 否则 409；执行前 DELETE chunks + deleteVectors 清理旧数据

### Decision: Admin 组件拆分
**选: 按标签拆子组件** — AdminTrends.vue / AdminErrorDocs.vue 独立文件，AdminPage.vue 维持 ≤300 行

## 实施步骤

### Phase 1: DB Schema
- `src/db/schema.ts`: documents 表新增 `progressStep: varchar("progress_step", { length: 20 })`
- `npm run db:generate && npm run db:migrate`

### Phase 2: 类型扩展
- `src/types.ts`: ChunkSource 新增 `vectorScore?: number`

### Phase 3: 检索透传
- `src/services/retrieval.service.ts`: retrieve() 在组装 ChunkSource 时保留原始向量相似度到 vectorScore

### Phase 4: 后端 API
- `src/routes/admin.ts`: 
  - GET /api/admin/trends?days=30 → { days, questions, activeUsers }
  - GET /api/admin/error-docs → error 文档列表
- `src/routes/doc.ts`:
  - POST /api/kb/:id/docs/:docId/retry → 乐观锁 + 清理旧数据 + 重新处理
  - GET /api/kb/:id/docs/:docId/progress → { status, progressStep, errorMessage }
- `src/services/doc.service.ts`: processDocumentAsync 5 阶段各写 progressStep

### Phase 5: 前端
- `npm install echarts`（client 目录）
- `client/src/pages/AdminPage.vue`: 拆分标签，新增 trends/error-docs 标签
- `client/src/components/AdminTrends.vue`: ECharts 按需引入，双Y轴折线图
- `client/src/components/AdminErrorDocs.vue`: 失败文档表格 + 重试按钮
- `client/src/components/MessageBubble.vue`: 置信度标签（基于 vectorScore 三色）
- `client/src/components/DocList.vue`: 5 步进度指示器 + 动画

## 验收标准
1. 趋势图: 30 天双折线图，空数据降级
2. 失败汇聚: error 文档列表 + 重试功能
3. 置信度: vectorScore 三色标记，高/中/低色正确
4. 分步进度: 5 步骤动画流转

## 变更清单
| 类型 | 文件 |
|------|------|
| 修改 | schema.ts, types.ts, retrieval.service.ts, doc.service.ts, admin.ts, doc.ts |
| 前端修改 | AdminPage.vue, MessageBubble.vue, DocList.vue |
| 前端新增 | AdminTrends.vue, AdminErrorDocs.vue |
| 新依赖 | echarts (client) |
| 新端点 | 4 个 |
| 新 DB 列 | 1 个 |
