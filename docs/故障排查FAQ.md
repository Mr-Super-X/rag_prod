# 故障排查 FAQ

常见问题与解决方案。按场景分类，从安装到日常使用。

---

## 安装与启动

### Q: `docker-compose up -d` 拉取镜像失败？

**现象**：停留在 "Pulling..." 或报 `dial tcp: connect: connection refused`。

**原因**：国内网络直连 Docker Hub 失败。

**方案 A（推荐）**：用已导出的离线包导入，无需网络。详见 README → "无网络环境：离线导入镜像与模型"。

**方案 B**：配置 VPN/代理，详见 README → "Docker 网络配置（国内用户必看）"。

**方案 C**：配置国内镜像源。Docker Desktop → Settings → Docker Engine，添加：

```json
{
  "registry-mirrors": ["https://registry.cn-hangzhou.aliyuncs.com"]
}
```

> 镜像源可能不稳定，方案 A 最可靠。

### Q: `docker exec ollama pull` 拉取模型失败？

**现象**：卡在 "pulling manifest" 或报 `dial tcp: i/o timeout`。

**原因**：模型托管在 `registry.ollama.ai`，同样需要 VPN。

**方案 A**：用离线包 `ollama-models.tar.gz` 导入（见 README）。

**方案 B**：开启 VPN 后重试，多次重试（Ollama 支持断点续传）。

### Q: 启动后端报 `connect ECONNREFUSED 127.0.0.1:5432`？

**原因**：PostgreSQL 或 Redis 容器未启动。

```bash
docker ps | grep -E "postgres|redis"
# 输出为空 → 容器未启动
docker-compose up -d
```

### Q: `npm install` 报错？

**原因**：Node.js 版本过低。本项目需要 Node.js >= 20。

```bash
node -v   # 应显示 v20.x.x 或更高
```

版本过低请到 https://nodejs.org 下载 LTS 版本。

---

## 文档处理

### Q: 上传文档后状态始终显示"处理中"？

**原因**：Ollama 离线或模型未拉取。后端异步处理文档时需要调用 Ollama embedding API。

```bash
# 检查 Ollama 是否运行
curl http://localhost:11434/api/tags

# 如果返回空或 404，启动 Ollama
docker-compose up -d ollama

# 确认模型已拉取（应包含 qwen2.5:7b 和 bge-m3）
curl http://localhost:11434/api/tags
```

### Q: 文档处理报"处理失败"（红色状态标签）？

**原因**：通常是文件损坏或格式不兼容。

1. 确认文件能正常打开（不是 0 字节或损坏文件）
2. 尝试将 PDF 转换为文本格式再上传
3. 查看后端终端错误日志，具体错误信息会记录在 `documents.error_message` 字段

### Q: 处理大 PDF 特别慢？

**原因**：CPU 推理，BGE-m3 embedding 计算量大。

正常的处理速度参考（纯 CPU）：
- 10 页 PDF：1-2 分钟
- 50 页 PDF：5-10 分钟

注意上传后立即返回，处理在后台异步进行，不影响使用。

---

## 问答体验

### Q: 回答问题非常慢，每个字等 2-3 秒？

**原因**：本地 CPU 推理 Qwen2.5-7B，这是正常速度。

**加速方案**：

1. **换更小模型**：`ollama pull qwen2.5:3b`，编辑 `.env` 改 `LLM_MODEL=qwen2.5:3b`
2. **换云端 API**：`.env` 中设置 `LLM_PROVIDER=deepseek` + `DEEPSEEK_API_KEY=你的密钥`，秒级回答

### Q: 返回"抱歉，当前知识库中未找到与您问题相关的内容"？

**原因**：检索结果为 0，知识库中确实没有相关文档内容。

- 换个更具体或不同的关键词试试
- 确认知识库中已上传了包含相关内容的文档
- 确认文档状态为"就绪"（绿色标签），不是"处理中"

### Q: 回答的内容与文档不符 / 编造了不存在的信息？

**原因**：LLM 幻觉。RAG 限定在检索到的上下文中，但 LLM 有时会忽略约束。

- 重新措辞问题
- 检查引用来源（`source` 字段）确认哪些文档片段被检索到
- 当前已知限制：无 Reranker 时检索精度有提升空间

### Q: 前端页面空白？

**原因**：通常后端未启动或网络不通。

1. 确认后端终端中显示 "RAG Enterprise API running at http://localhost:3000"
2. 确认前端终端中显示 `VITE vx.x.x ready in xxxms`，地址是 `http://localhost:5173`
3. 浏览器 F12 → Network 查看 API 请求状态

### Q: 刷新页面后用户信息丢失，需要重新登录？

**原因**：refreshToken 过期或被清除。

- refreshToken 有效期 7 天，过期后需重新登录
- 清除浏览器缓存 / localStorage 会导致丢失

---

## 数据库

### Q: 如何重置数据库？

```bash
# 进入 PostgreSQL 容器
docker exec -it rag_prod-postgres-1 psql -U raguser -d ragdb

# 删除所有数据
DROP TABLE IF EXISTS message_feedback, messages, conversations, chunks, documents, kb_members, refresh_tokens, api_keys, audit_logs, knowledge_bases, users CASCADE;

# 退出
\q

# 重新运行迁移
npx drizzle-kit migrate
```

### Q: 如何备份数据？

```bash
npm run backup
# 备份输出在 backups/ 目录
```

---

## 模型

### Q: 换 Embedding 模型后需要做什么？

**答案**：必须删除向量数据并重新上传所有文档。

```bash
# 删除旧的向量索引
rm -rf data/lancedb/

# 修改 .env 中的 EMBEDDING_MODEL 和 EMBEDDING_DIM
# 重新上传所有文档
```

> 换 LLM 模型不需要重建向量索引，只需改 `LLM_MODEL` 并重启。

### Q: 如何查看 Ollama 已安装的模型？

```bash
# Docker 内 Ollama
docker exec -it rag_prod-ollama-1 ollama list

# 或 HTTP API
curl http://localhost:11434/api/tags

---

## V11 功能

### Q: 生成 API Key 时返回 500？

**原因**：通常是 API Key 哈希算法与数据库记录不匹配，或 `keyPrefix` 字段长度超限。

检查：
- 确认 `src/routes/auth.ts` 和 `src/middleware/auth.ts` 中 keyHash 使用 `crypto.createHmac("sha256", JWT_SECRET)`
- 确认 `src/db/schema.ts` 中 `keyPrefix` 为 `varchar(10)`
- 确认已执行 `npx drizzle-kit generate && npx drizzle-kit migrate` 创建 `api_keys` 表

### Q: 登录报 "Invalid or expired token"？

**原因**：V11 新增的 `authenticate` hook 可能污染了登录路由。

检查 `src/routes/auth.ts`：
- 确认没有 `app.addHook("onRequest", authenticate)` 全局 hook
- API Key 路由应使用 `{ preHandler: [authenticate] }` 单独鉴权

### Q: 审计日志或反馈统计页面为空？

**原因**：数据库表尚未创建。

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

确认 `audit_logs`、`message_feedback` 表已存在。

### Q: 如何使用 API Key 调用问答接口？

```bash
curl -X POST http://localhost:3000/api/kb/{kbId}/chat \\
  -H "Authorization: Bearer ak_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  -d '{"question": "你的问题"}'
```

注意：API Key 端点也支持 JWT（原有的 `Authorization: Bearer <jwt>` 仍然可用）。
```

---

## V14 常见问题

### Q: 对话时页面显示 "This operation was aborted"

**现象**：提问后等待一段时间，页面输出 "This operation was aborted"，无回答。

**原因**：CPU Ollama 加载大模型（Qwen2.5:7B 约 4.7GB）首次推理或模型未预热时，加载时间可能超过 60 秒。`generator.ts` 的 `fetchWithTimeout` 超时后 `AbortController` 触发 abort，Fastify 向上传播 `AbortError`。

**修复**（V14.1）：
1. `ollamaChat`/`ollamaStream` 超时从 60s 扩大到 180s
2. `reranker.ts` 禁用 `similarityRerank`（CPU embed 批量调用延迟不可控），直接走 LLM listwise 精排
3. `vitest.config.ts` testTimeout 120s→300s

**预防**：首次提问前运行 `ollama run qwen2.5:7b "hello"` 预热模型。

### Q: 缓存命中率始终为 0

**现象**：Admin → 性能标签显示缓存命中率 0%。

**原因**：缓存 key 包含 Embedding 模型名（`EMBEDDING_MODEL`）。如果切换过模型，旧缓存 key 不再匹配。

**解决**：正常现象。新模型下首次提问走完整 RAG 链路并新建缓存，后续重复提问会命中。

### Q: 向量迁移中途崩溃如何恢复

**现象**：Admin → AI 引擎发起迁移后进程崩溃，KB 卡在 `migrating` 状态。

**解决**：
```sql
-- 手动重置迁移状态
UPDATE knowledge_bases SET migration_status = 'failed' WHERE migration_status = 'migrating';
```
然后重新发起迁移。`rollbackMigration()` 会自动清理残留的新表。
