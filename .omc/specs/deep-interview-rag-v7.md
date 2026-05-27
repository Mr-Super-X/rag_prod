# Spec: RAG V7 — 体验增强

## Metadata
- Spec ID: rag-v7-ux-enhancement-20260527
- Status: completed
- Type: brownfield
- Version: V7

## Goal

小范围体验优化：KB 列表按归属分组、思考过程分阶段展示、扩展文档格式支持。

## Scope

### KB 列表分组
- 将知识库列表分为"我创建的"和"共享给我的"两组
- 纯前端实现

### 思考过程动画优化
- 从单纯的"检索中..."扩展为"检索中→生成中"两阶段
- 阶段切换由实际 SSE 流状态驱动

### 文件格式扩展
- 新增 Excel(.xlsx) 解析
- 新增 PPT(.pptx) 解析（ZIP XML 文本提取，零外部依赖）
- 上传白名单从 4 种扩展到 6 种

## Acceptance Criteria
- [x] KB 列表正确分组显示
- [x] 思考过程动画随流程切换
- [x] 上传 xlsx 文件可正常解析
- [x] 上传 pptx 文件可正常解析

## Technical Notes
- xlsx 需要 npm install xlsx
- pptx 解析复用已有 ZIP 能力，无需新依赖
