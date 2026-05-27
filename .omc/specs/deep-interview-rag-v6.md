# Spec: RAG V6 — 成员管理 UI + Agent 能力

## Metadata
- Spec ID: rag-v6-members-agent-20260526
- Status: completed
- Type: brownfield
- Version: V6

## Goal

补全 KB 成员管理的前端交互（已有后端接口但无 UI），并为 LLM 添加基础 Agent 能力。

## Scope

### 成员管理 UI
- 成员列表展示（含用户名）
- 通过用户名添加成员
- 移除成员（不可移除 owner）
- KB 详情页新增"成员"标签页

### Agent 能力
- LLM 意图检测，识别是否可被工具调用替代
- 时间查询和简单计算器两个内置工具
- 功能开关控制

## Acceptance Criteria
- [x] KB 详情页可查看、添加、移除成员
- [x] owner 不可被移除
- [x] Agent 可识别"现在几点"并返回当前时间
- [x] Agent 可执行简单算术运算
- [x] `AGENT_ENABLED=false` 时跳过 Agent 流程

## Technical Notes
- 成员 API 在 V4 已建立（后端），V6 补前端 UI
- Agent 通过检索前拦截实现，函数调用直接返回结果
