# Plan: RAG V6 — 成员管理 UI + Agent 能力

## Metadata
- Plan ID: rag-v6-members-agent-20260526
- Status: completed
- Version: V6

## Goal

补全 KB 成员管理的完整前端 UI，添加 LLM Agent 基础能力（意图检测 + 工具调用）。

## Tasks

### 1. KB 成员管理 UI
- [x] `GET /api/kb/:id/members` — JOIN users 查成员列表（含用户名）
- [x] `POST /api/kb/:id/members` — 通过用户名添加成员
- [x] `DELETE /api/kb/:id/members/:userId` — 移除成员（不可移 owner）
- [x] `MemberManager.vue` 前端成员管理面板
- [x] KB 详情页新增"成员"标签
- 文件：`src/routes/kb.ts`, `client/src/components/MemberManager.vue`, `client/src/pages/KBDetailPage.vue`

### 2. Agent 能力
- [x] `agent.ts` — LLM 意图检测 `detectAndExecute()`
- [x] `get_current_time` 时间查询函数
- [x] `simple_calculator` 计算器函数
- [x] 检索前拦截：函数调用时跳过检索
- [x] `AGENT_ENABLED=true` 功能开关
- 文件：`src/pipeline/agent.ts`, `src/services/chat.service.ts`, `src/config.ts`

## Technical Impact

| 指标 | Before | After |
|------|--------|-------|
| API 端点 | 15 | 18 (+3 成员) |
| 后端源文件 | 34 | 34 |
| 前端源文件 | 28 | 28 |
