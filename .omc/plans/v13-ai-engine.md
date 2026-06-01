# V13 AI 引擎配置统一 — 实施方案

## RALPLAN-DR

### Principles
1. 最小侵入 — 不重构 config.ts 同步单例，不改 15+ 文件
2. 可逆操作 — 向量迁移先建新表后切引用，旧表保留 7 天
3. 写保护 — 迁移期间仅阻断上传/retry，不影响查询/对话/导出
4. 零重启 LLM 切换 — LLM Provider 运行时生效；Embedding 需重启

### Decision: 配置存储
**选: 环境变量 + .env 文件 + 重启确认**
- 放弃 PG `ai_configs` 表方案 — 15+文件同步→异步改造不可接受
- Admin UI 写 `.env` 文件，提示管理员重启生效
- LLM Provider 切换：`config.ts` 已在每次 `generate()` 调用时读取 `config.LLM_PROVIDER`，修改 `process.env` + `.env` 后运行时生效
- Embedding 切换：需重启（向量维度变化需全量重建）

### Decision: 向量迁移策略
**选: 新建表 + 切换引用 + 旧表保留 7 天**
- 不依赖 LanceDB `renameTable`（0.29.0 未验证）
- 迁移流程：embed 到新表 `kb_{id}_v{N}` → 校验 chunk 数 → 更新 `chunks.qdrantPointId` → 旧表保留
- 回滚：删除新表，旧表不变

## 实施步骤

### Phase 1: 后端迁移引擎
- `src/db/schema.ts`: `knowledge_bases` 新增 `migrationStatus` 列(idle/migrating/ready/failed)
- `src/lib/vector-migration.ts` (新建): `startMigration()`, `runMigration()`, `finalizeMigration()`, `rollbackMigration()`
- `src/routes/ai-engine.ts` (新建):
  - `GET /api/admin/ai-engine/models` — 调 Ollama `/api/tags`
  - `GET /api/admin/ai-engine/config` — 当前配置
  - `POST /api/admin/ai-engine/config` — 更新 .env + process.env
  - `POST /api/admin/ai-engine/migrate/:kbId` — 启动迁移
  - `GET /api/admin/ai-engine/migrate/:kbId/progress` — SSE 进度
  - `POST /api/admin/ai-engine/benchmark` — 性能基线
- `src/routes/doc.ts`: upload + retry 端点检查 migrationStatus
- `src/routes/admin.ts`: 注册 ai-engine 路由

### Phase 2: 前端
- `client/src/pages/AdminPage.vue`: +tab "AI 引擎"
- `client/src/components/AdminAIEngine.vue` (新建): 模型选择 + LLM 配置 + 迁移进度
- `client/src/components/AdminBenchmark.vue` (新建): 基准测试面板

## 变更清单
| 文件 | 类型 | 预估行数 |
|------|------|---------|
| src/db/schema.ts | MODIFY | +5 |
| src/routes/doc.ts | MODIFY | +5 |
| src/routes/admin.ts | MODIFY | +2 |
| src/lib/vector-migration.ts | NEW | ~150 |
| src/routes/ai-engine.ts | NEW | ~200 |
| client/src/pages/AdminPage.vue | MODIFY | +5 |
| client/src/components/AdminAIEngine.vue | NEW | ~280 |
| client/src/components/AdminBenchmark.vue | NEW | ~150 |

**总计: ~8 文件, ~800 行**

## 性能影响注意点
- 向量迁移使用 batch=5（与现有 embed 批大小一致），避免 Ollama 过载
- 迁移期间 KB 置为只读（migrationStatus 检查），不影响其他 KB 的查询
- SSE 进度推送每批汇报一次，不逐条推送
- 旧 LanceDB 表保留 7 天，不删除（避免误删 + 支持回滚）
