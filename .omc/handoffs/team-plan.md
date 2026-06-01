## Handoff: team-plan → team-exec
- **Decided**: 4 任务 2 worker 并行。Task#1(DB+schema) 和 Task#2(路由+迁移) 无依赖可并行；Task#3(AdminAIEngine) 和 Task#4(AdminBenchmark) 依赖 #1+#2 完成。
- **Rejected**: PG config-store（15+文件同步→异步改造成本过高）；LanceDB renameTable（SDK 0.29.0 未验证原子性）
- **Risks**: embedder.ts 改签名影响现有调用方；LanceDB 新表创建需验证表名格式；.env 写入需保留原有内容
- **Files**: .omc/plans/v13-ai-engine.md, src/db/schema.ts, src/routes/doc.ts, src/lib/vector-migration.ts, src/routes/ai-engine.ts, src/pipeline/embedder.ts, src/routes/admin.ts, client/src/components/AdminAIEngine.vue, client/src/components/AdminBenchmark.vue, client/src/pages/AdminPage.vue
- **Remaining**: Worker-1 完成后需分配给 #3；Worker-2 完成后需分配给 #4
