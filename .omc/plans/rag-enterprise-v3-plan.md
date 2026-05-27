# RALPLAN-DR: RAG 知识库平台 V3 实现方案

## Principles
1. **基础设施改进，不碰业务逻辑**：备份和日志是运维工具，增量索引是管线优化，都不改变 API
2. **默认关闭，显式启用**：增量索引默认 false，用户确认后再开
3. **最小依赖**：不引入新 npm 包，备份用 Node.js 内置 child_process，日志用已有的 Pino

## Implementation

### 第一批：备份 + 日志

```
Step 1: src/lib/logger.ts — Pino 配置（双输出：console + 文件，requestId 自动注入）
Step 2: src/app.ts — 替换 Fastify logger 为自定义 Pino，注册 requestId hook
Step 3: scripts/backup.ts — PG dump + tar LanceDB/uploads + 清理旧备份
Step 4: package.json — 添加 "backup" script
Step 5: docs/ — 更新备份恢复说明
```

### 第二批：增量索引

```
Step 6: src/config.ts — INCREMENTAL_INDEX 开关
Step 7: src/pipeline/splitter.ts — splitText 返回 chunk hash
Step 8: src/services/doc.service.ts — hash 比对逻辑 + 复用未变化 chunk
```
