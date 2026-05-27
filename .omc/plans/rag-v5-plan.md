# Plan: RAG V5 — 云端 LLM + 深色模式 + E2E

## Metadata
- Plan ID: rag-v5-cloud-dark-e2e-20260526
- Status: completed
- Version: V5

## Goal

让用户能切换云端 LLM 获得秒级回答、添加深色模式支持、建立 E2E 自动化测试。

## Tasks

### 1. 云端 LLM 切换
- [x] `config.ts` 添加 `LLM_PROVIDER` 和 `DEEPSEEK_API_KEY` 配置项
- [x] `generator.ts` 工厂模式：`deepseekChat()` / `deepseekStream()` 
- [x] API 失败自动降级到本地 Ollama
- [x] Embedding 始终本地（不改动）
- 文件：`src/config.ts`, `src/pipeline/generator.ts`

### 2. 深色模式 + 移动端
- [x] CSS 变量暗色主题：`body.dark {}`
- [x] ☀/☾ 一键切换按钮 + localStorage 记忆
- [x] 768px 断点响应式布局
- 文件：`client/src/App.vue`, `client/src/components/AppLayout.vue`

### 3. E2E 测试
- [x] Playwright 安装与配置
- [x] 全流程测试：注册→登录→创建 KB→上传→提问
- [x] `npm run test:e2e` 命令
- 文件：`test/e2e/rag-flow.spec.ts`, `package.json`

## Technical Impact

| 指标 | Before | After |
|------|--------|-------|
| 后端源文件 | 33 | 33 |
| 数据库表 | 8 | 8 |
| E2E 测试 | 0 | 1 |
