# Deep Interview Spec: RAG 知识库平台 V3

## Metadata
- Interview ID: rag-v3-20260527
- Rounds: 2
- Final Ambiguity Score: 11%
- Type: brownfield
- Generated: 2026-05-27
- Threshold: 20%
- Status: PASSED

## Goal

V3 做三个基础设施增强，分两批：
- **第一批**：数据库备份脚本 + 结构化日志（Pino 文件持久化）
- **第二批**：文档增量索引（chunk hash 比对，只重建变化的）

## Constraints
- 硬件不变（Intel 核显，CPU 推理）
- 不破坏 V1/V2 API
- 备份存本地 `./backups/` 目录，保留 7 天
- 日志存 `./logs/` 目录，按天轮转

## Acceptance Criteria

### 第一批：备份 + 日志

- [ ] `scripts/backup.ts` 脚本：dump PG → tar LanceDB + uploads → 保留7天旧备份
- [ ] 备份每日凌晨 3 点自动执行（crontab 或 node-cron）
- [ ] Pino 输出同时写入控制台 + 文件（`./logs/app-YYYY-MM-DD.log`）
- [ ] 每个请求自动注入唯一 requestId
- [ ] 日志包含：时间戳、级别、requestId、消息、错误堆栈

### 第二批：增量索引

- [ ] 文档上传时，对每个 chunk 计算 SHA256 hash
- [ ] 重新上传同名文档时，比对 hash，只重建变化和新增的 chunk
- [ ] 删除的 chunk 从 LanceDB 和 Redis BM25 中清理
- [ ] 未变化的 chunk 复用原有向量和索引（真正零开销）
- [ ] 增量索引功能默认关闭（`INCREMENTAL_INDEX=true`），V1 全量模式仍可用

## Non-Goals
- 云存储备份
- 速率限制
- 多租户数据隔离
- E2E 测试
- 移动端适配
