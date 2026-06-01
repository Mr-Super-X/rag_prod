# CHANGELOG

本文件记录 RAG 企业知识库平台所有版本的功能变更、bug 修复和破坏性变更。

---

## V13 — 2026-06-01

### Added
- AI 引擎配置统一面板：Admin → AI 引擎标签，可视化管理 Embedding/LLM
- `vector-migration.ts` — 向量迁移引擎（批量 embed→新表→校验→切版本引用）
- `ai-engine.ts` — 6 个 Admin API 端点（models/config/migrate/progress/benchmark）
- 迁移期间写保护：upload/retry 返回 503
- `AdminAIEngine.vue` + `AdminBenchmark.vue` 组件
- `vectorVersion` 机制：LanceDB 按版本后缀组建表名，迁移后自动切换搜索路径

### Changed
- `embedder.ts` — `embed()`/`embedSingle()` 新增可选 `modelName` 参数
- `vectordb.ts` — 新增 `setVectorVersion()` + `fullTableName()` 版本化表名
- `generator.ts` — Ollama fetch 加 60s `AbortController` 超时
- `admin.ts` — kbs 端点返回 `migrationStatus`

### Fixed
- 趋势图空白：loading=false 顺序 + 日期 UTC→本地 + ECharts 全量导入

---

## V12 — 2026-05-29

### Added
- Admin 使用趋势图 + 失败任务汇聚 + 回答置信度 + 文档分步进度
- `GET /api/admin/trends`, `GET /api/admin/error-docs`, `POST retry`, `GET progress`
- `vectorScore` 透传 + 三色置信度标签
- `AdminTrends.vue` / `AdminErrorDocs.vue` 组件

### Changed
- `documents.progressStep` 列 + `processDocumentAsync` 5 阶段写入
- `vitest.config.ts`: `fileParallelism=false` + testTimeout 120s
- `test.setup.ts`: DROP SCHEMA CASCADE + `migrate()` 建表

### Fixed
- 5 个集成测试 pg_type 冲突（并行 setup 竞态）
- Ollama 加载超时挂死（fetchWithTimeout）
- retry TOCTOU（原子 update+returning）

---

## V11 — 2026-05-27

### Added
- 消息反馈(👍/👎) + 审计日志 + API Key(HMAC-SHA256) + 使用仪表盘
- `SettingsPage.vue` API Key 管理

### Changed
- 对话列表仅在初始加载 + 新对话时刷新

---

## V10 — 2026-05-26

### Added
- 引用高亮 [N] 点击展开 + 文档预览弹窗 + 对话搜索

---

## V9 — 2026-05-26

### Added
- 对话导出 Markdown + KB 使用统计

---

## V8 — 2026-05-26

### Added
- 管理员控制台（用户/KB 管理）

---

## V7 — 2026-05-26

### Added
- KB 列表分组 + xlsx/pptx 解析

---

## V6 — 2026-05-26

### Added
- KB 成员管理完整 UI（成员列表、添加、移除）
- `GET /api/kb/:id/members` — 查看知识库成员（含用户名）
- `POST /api/kb/:id/members` — 通过用户名添加成员
- `DELETE /api/kb/:id/members/:userId` — 移除成员（不可移除 owner）
- `MemberManager.vue` 前端成员管理面板
- Agent 能力：LLM 意图检测（时间查询、计算器），通过 `AGENT_ENABLED` 开关控制

---

## V5 — 2026-05-26

### Added
- 云端 LLM 一键切换：`LLM_PROVIDER=ollama|deepseek`，DeepSeek API 秒级回答
- API 失败自动降级至本地 Ollama
- 深色模式：CSS 变量暗色主题 + ☀/☾ 一键切换 + localStorage 记忆
- 移动端 768px 断点响应式布局
- Playwright E2E 测试：注册→登录→创建 KB→上传→提问 全流程
- `npm run test:e2e` 命令

---

## V4 — 2026-05-26

### Added
- 全局速率限制：60 次/分钟，超标返回 429
- 多租户数据隔离：`kb_members` 表 + `requireKBAccess` 中间件
- 文档处理进度自动轮询：有处理中文件时每 3 秒刷新，就绪后自动停止
- 思考过程动画："检索中..."脉冲指示器，首 token 到达后消失

### Changed
- 非 KB 成员访问返回 403
- KB 创建者自动成为 owner 成员，兼容旧数据

---

## V3 — 2026-05-26

### Added
- 数据库备份系统：`scripts/backup.ts`，支持 PG dump + LanceDB tar.gz + 上传文件备份
- 旧备份自动清理（7 天）
- `npm run backup` 一键备份
- 结构化日志：Pino 双输出（console + 文件），按天日志文件，requestId 自动注入
- 增量索引：chunk SHA256 hash 比对，仅重建变化 chunk，`INCREMENTAL_INDEX` 开关控制

---

## V2 — 2026-05-26

### Added
- SSE 流式回答：`text/event-stream` 协议，逐字输出
- Ollama stream 模式 `streamGenerate()`
- 前端逐 token 渲染 + POST 方式 SSE（支持 Authorization header）
- Nginx 反代流式兼容：`X-Accel-Buffering: no` header
- JWT 安全加固：access token（15min）+ refresh token（7d）+ rotation 机制
- `POST /api/auth/refresh` 刷新端点
- 前端自动无感刷新：401 拦截 → refresh → 重试，并发 refresh 去重
- 密码强度校验：≥8 位 + 字母 + 数字
- 用户信息持久化：刷新页面不丢失登录态
- Reranker 精排：LLM 相关性打分（0-1），候选池扩大至 25，失败自动降级

### Changed
- login 响应兼容 V1：同时返回 `token` 和 `accessToken`

---

## V1 — 2026-05-26

### Added
- 用户系统：注册、登录、JWT 认证、admin/user 角色
- 初始管理员账号：admin/admin123
- 知识库 CRUD（创建/列表/详情/编辑/删除）
- 文档上传（PDF/Word/MD/TXT），格式校验 + 50MB 限制
- 异步文档处理（上传即返回，后台 parse→split→embed→store）
- PDF 解析（pdf-parse）、Word 解析（mammoth）
- 文本智能切分（500 字 + 50 字重叠）
- BGE-m3 向量化（1024 维）
- LanceDB 向量存储 + Redis BM25 倒排索引
- RRF 融合排序（k=60）
- Qwen2.5-7B 回答生成 + 引用来源追溯
- 多轮对话：上下文改写（指代消解）+ 6 条历史 + 标题自动生成
- Vue 3 前端：登录/注册/知识库列表/问答交互/文档管理/对话历史
- Docker Compose 部署（PG + Redis + Ollama）
- Swagger API 文档（`/docs`）+ 健康检查（`/api/health`）
- 集成测试（auth/kb/chat）
- AppError 错误分类处理体系
