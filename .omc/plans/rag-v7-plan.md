# Plan: RAG V7 — 体验增强

## Metadata
- Plan ID: rag-v7-ux-enhancement-20260527
- Status: completed
- Version: V7

## Goal

提升用户日常使用体验：KB 列表分组、思考过程分阶段展示、支持 Excel/PPT 文件格式。

## Tasks

### 1. KB 列表分组
- [x] 分组展示："我创建的" / "共享给我的"
- [x] 纯前端实现，无需后端改动
- 文件：`client/src/pages/KBListPage.vue`

### 2. 思考过程分阶段展示
- [x] 检索中 → 生成中 两阶段动画
- [x] 阶段切换由实际流程状态驱动
- 文件：`client/src/components/ChatPanel.vue`

### 3. Excel/PPT 解析
- [x] Excel(.xlsx)：安装 `xlsx` npm 包，提取单元格文本
- [x] PPT(.pptx)：ZIP XML 文本提取（无外部依赖）
- [x] 上传白名单扩展：`.docx, .pdf, .md, .txt, .xlsx, .pptx`
- 文件：`src/pipeline/parser.ts`, `src/routes/doc.ts`

## Technical Impact

| 指标 | Before | After |
|------|--------|-------|
| 后端源文件 | 34 | 34 |
| 前端源文件 | 28 | 28 |
| API 端点 | 18 | 18 |
| 新增 npm 依赖 | — | xlsx |
