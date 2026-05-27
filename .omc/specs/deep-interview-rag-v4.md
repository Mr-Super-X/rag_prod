# Deep Interview Spec: RAG 知识库平台 V4

## Metadata
- Interview ID: rag-v4-20260527
- Rounds: 1
- Ambiguity: 5%
- Status: PASSED

## Goal
V4 做四个体验和安全增强：速率限制、多租户数据隔离、文档处理进度推送、思考过程展示。

## Acceptance Criteria
- [ ] @fastify/rate-limit 60次/分钟/IP，超标返回 429
- [ ] kb_members 表 + 中间件，仅 owner 和成员可访问 KB
- [ ] SSE 流推送文档处理百分比到前端
- [ ] 聊天面板显示"检索中→分析中→生成中"状态流转
