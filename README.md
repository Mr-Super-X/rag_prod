# RAG 企业知识库平台

基于 RAG（检索增强生成）的企业级知识库问答平台。支持多知识库管理、文档上传、混合检索、多轮对话、引用来源追溯。

## 架构

```
┌─────────────────────┐     ┌──────────────────┐
│   Vue 3 前端 (5173)  │────▶│  Fastify API (3000)│
└─────────────────────┘     └────────┬─────────┘
                                     │
          ┌──────────────────────────┼──────────────────────┐
          ▼                          ▼                      ▼
   ┌──────────┐              ┌──────────────┐       ┌──────────┐
   │ PostgreSQL│              │  Ollama       │       │  Redis   │
   │  元数据    │              │  LLM+Embedding│       │  缓存+BM25 │
   └──────────┘              └──────────────┘       └──────────┘
                                     │
                              ┌──────┴──────┐
                              │  Qwen2.5-7B │  文本生成
                              │  BGE-m3     │  向量化
                              └─────────────┘

存储层：LanceDB（嵌入式向量库）+ PostgreSQL（元数据）+ Redis（会话+BM25倒排）
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue 3 + TypeScript + Pinia + Vue Router + Vite |
| 后端 | Node.js + TypeScript + Fastify |
| 数据库 | PostgreSQL + Drizzle ORM |
| 向量库 | LanceDB（嵌入式） |
| LLM | Ollama + Qwen2.5-7B |
| Embedding | Ollama + BGE-m3（1024 维） |
| 缓存 | Redis |
| 部署 | Docker Compose |

## 前置条件

- **Node.js** >= 20（终端输入 `node -v` 查看版本）
- **Docker**（Windows/Mac 装 Docker Desktop，Linux 装 docker-ce。用于运行 PostgreSQL、Redis）
- **Ollama**（Docker 或原生安装均可，见下方）
- **内存** >= 16GB（Qwen2.5-7B 需要 ~5GB）
- **磁盘** >= 20GB（模型文件 + 文档存储）
- **网络**：镜像和模型下载需访问 Docker Hub，国内网络需 VPN/代理。详见下方 [Docker 网络配置](#docker-网络配置国内用户必看)

> 无 GPU 可运行，CPU 推理较慢（文档处理 1-2 分钟/份）。
> Apple Silicon Mac 上原生运行 Ollama，推理速度明显优于 Docker 内运行。

## Docker 网络配置（国内用户必看）

国内网络直连 Docker Hub 大概率失败，以下为实测有效的配置。

### 1. 清理失效镜像源

打开 Docker 配置文件：

- **Windows/Mac**：Docker Desktop → Settings → Docker Engine
- **Linux**：`sudo nano /etc/docker/daemon.json`

确认 `registry-mirrors` 中**不包含**以下已失效的源：

- `http://hub-mirror.c.163.com`（网易，域名已不存在）
- `https://mirror.baidubce.com`（百度，域名已不存在）
- `https://d2bgx7ku.mirror.aliyuncs.com`（阿里云个人加速，过期返回 403）

全部清空或仅保留 `https://registry.cn-hangzhou.aliyuncs.com`。

### 2. 配置代理（关键）

Docker 的代理配置分两处，**两处都要配**，只配一处拉镜像仍会直连失败：

**位置 A**：Docker 自身拉镜像走这里

- **Windows/Mac**：Docker Desktop → Settings → Resources → Proxies
- **Linux**：跳过此步（Linux 版 Docker 通过系统代理自动走）

```
HTTP Proxy:  http://127.0.0.1:7890
HTTPS Proxy: http://127.0.0.1:7890
```

**位置 B**：容器内进程走这里

- **Windows/Mac**：Docker Desktop → Settings → Docker Engine
- **Linux**：编辑 `/etc/docker/daemon.json`

```json
{
  "proxies": {
    "default": {
      "httpProxy": "http://127.0.0.1:7890",
      "httpsProxy": "http://127.0.0.1:7890"
    }
  }
}
```

> 端口 `7890` 是 Clash 默认端口，根据你实际使用的代理软件修改（V2Ray 通常为 `10809`，SSR 通常为 `1080`）。

### 3. 验证

```bash
docker pull hello-world
```

能拉下来说明配置生效。改完配置后需要点 **Apply & Restart**，等 Docker 图标变绿再操作。

## 无网络环境：离线导入镜像与模型

如果在没有 VPN 的机器上运行，可以用另一台已拉取好镜像和模型的机器导出，再离线导入目标机器。

> 项目 `exports/` 目录已包含预导出的镜像和模型文件，可直接拷贝使用。

**导出文件对应关系：**

| 来源 | 类型 | 导出文件 | 大小 |
|------|------|----------|------|
| `docker-compose.yml` → `image: postgres:15-alpine` | Docker 镜像 | `postgres-15-alpine.tar` | ~95MB |
| `docker-compose.yml` → `image: redis:7-alpine` | Docker 镜像 | `redis-7-alpine.tar` | ~17MB |
| `docker-compose.yml` → `image: ollama/ollama:latest` | Docker 镜像 | `ollama-latest.tar` | ~4GB |
| `ollama pull qwen2.5:7b` | 模型文件（存在数据卷内） | 合在 `ollama-models.tar.gz` 中 | |
| `ollama pull bge-m3` | 模型文件（存在数据卷内） | | ~5.3GB |

> **为什么是 4 个文件而非 5 个？** — `ollama pull` 拉取的是模型文件，不是 Docker 镜像。两个模型（qwen2.5:7b + bge-m3）都存储在同一个 Docker 数据卷 `rag_prod_ollamadata` 中，导出时整个卷打包为一个 `ollama-models.tar.gz`。恢复时解压该文件，两个模型同时就位。

### 导出（有网络的机器）

```bash
# 创建导出目录
mkdir -p exports

# 导出 Docker 镜像（约 4.2GB）
docker save postgres:15-alpine -o exports/postgres-15-alpine.tar      # ~95MB
docker save redis:7-alpine -o exports/redis-7-alpine.tar              # ~17MB
docker save ollama/ollama:latest -o exports/ollama-latest.tar         # ~4GB

# 导出已拉取的模型（约 5.7GB）
docker run --rm -v rag_prod_ollamadata:/data -v $(pwd)/exports:/backup alpine \
  tar czf /backup/ollama-models.tar.gz -C /data .
```

> **Windows PowerShell 用户**：将 `$(pwd)` 替换为当前目录绝对路径。
> 
> 如果 Docker 卷名不同（`docker volume ls | grep ollama` 查看），替换 `rag_prod_ollamadata`。

### 导入（目标机器）

```bash
# 1. 将 exports/ 整个目录拷贝到目标机器（U 盘 / 移动硬盘 / 局域网 scp）

# 2. 导入 Docker 镜像
docker load -i exports/postgres-15-alpine.tar
docker load -i exports/redis-7-alpine.tar
docker load -i exports/ollama-latest.tar

# 3. 验证镜像已导入
docker images | grep -E "postgres|redis|ollama"
```

```bash
# 4. 先启动一次 Ollama 让它创建数据卷
docker-compose up -d ollama

# 5. 停止 Ollama 并导入模型文件
docker-compose stop ollama
docker run --rm -v rag_prod_ollamadata:/data -v $(pwd)/exports:/backup alpine \
  tar xzf /backup/ollama-models.tar.gz -C /data

# 6. 重新启动 Ollama
docker-compose start ollama

# 7. 验证模型可用
curl http://localhost:11434/api/tags
# 应返回 qwen2.5:7b 和 bge-m3
```

```bash
# 8. 启动全部服务
docker-compose up -d
```

> 镜像和模型都已本地存在，`docker-compose up -d` 不会再触发拉取。

## 快速启动

### 平台选择

| 平台 | Ollama 运行方式 | 使用文件 |
|------|----------------|---------|
| Windows / Linux | Docker 容器内 | `docker-compose.yml`（含 ollama 服务） |
| macOS | 原生安装（Metal GPU 加速） | `docker-compose.mac.yml`（仅 PG + Redis） |

### Windows / Linux

#### 1. 启动基础设施

```bash
docker-compose up -d
```

> **注意**：首次执行会从 Docker Hub 拉取 postgres/redis/ollama 三个镜像（约 2GB）。国内网络可能失败，需开启 VPN/代理。如果中断，重新执行即可续传。

#### 2. 拉取模型

```bash
docker exec -it rag_prod-ollama-1 ollama pull qwen2.5:7b
docker exec -it rag_prod-ollama-1 ollama pull bge-m3
```

> **注意**：模型文件托管在 Ollama 官方 registry（`registry.ollama.ai`），国内网络直连经常超时或中断。如果下载失败，需要：
> - 开启 VPN/代理后再执行
> - 或者多次重试（Docker 支持断点续传，中断后重新执行会从中断处继续）
> - Qwen2.5-7B 约 4.5GB，BGE-m3 约 1.2GB，总计约 5.7GB，网络不稳定时可能需要多轮拉取

### macOS

#### 1. 安装 Ollama（原生，推荐）

```bash
brew install ollama
ollama serve &                     # 后台启动服务
ollama pull qwen2.5:7b
ollama pull bge-m3
```

> **注意**：模型文件约 5.7GB，国内网络直连经常超时。需要 VPN/代理，或多次重试。

#### 2. 启动 PostgreSQL + Redis

```bash
docker-compose -f docker-compose.mac.yml up -d
```

> **注意**：首次执行会从 Docker Hub 拉取镜像（约 30MB）。国内网络可能失败，需 VPN/代理。

### 通用步骤（所有平台）

#### 3. 创建环境变量

在项目根目录手动创建 `.env` 文件，写入以下内容：

```
DATABASE_URL=postgresql://raguser:ragpass@localhost:5432/ragdb
OLLAMA_URL=http://localhost:11434
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-to-a-random-secret
UPLOAD_DIR=./data/uploads
# 以下两行可选：切换到云端 LLM 时取消注释并填入 API 密钥
# LLM_PROVIDER=deepseek
# DEEPSEEK_API_KEY=sk-你的密钥
```

> 生产环境请修改 `JWT_SECRET` 为随机字符串。

#### 4. 初始化数据库

```bash
npm install
npx drizzle-kit generate    # 根据 schema.ts 生成 SQL 迁移文件
npx drizzle-kit migrate     # 执行迁移，创建数据库表
```

### 5. 启动后端

```bash
npm run dev
```

→ API 地址：http://localhost:3000
→ Swagger 文档：http://localhost:3000/docs

#### 5.1 切换 LLM 推理模式

默认使用本地 Ollama（CPU 推理，慢）。如果要切换到云端 API 获得秒级回答：

在 `.env` 中修改两行，重启后端：

```
# 本地模式（默认）
LLM_PROVIDER=ollama

# 云端模式（DeepSeek，秒级回答）
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-你的API密钥
```

| 模式 | 速度 | 成本 | 数据安全 |
|------|------|------|---------|
| `ollama` | 每个字 2-3 秒 | 免费 | 全部本地 |
| `deepseek` | 秒级 | ¥0.001/次 | prompt 片段出内网 |

> 两种模式共用同一个 `.env` 文件，**改一行 + 重启后端**即可切换。Embedding 始终走本地 BGE-m3，文档内容不出内网。DeepSeek 不可用时自动降级回 Ollama。

#### 5.2 启用 Agent 能力（可选）

Agent 可让系统在检索文档前先判断问题是否需要调用函数（如时间查询、计算器），跳过文档直接返回结果。

在 `.env` 中加一行，重启后端：

```
AGENT_ENABLED=true
```

| 内置函数 | 用法示例 |
|---------|---------|
| 时间查询 | "现在几点" |
| 计算器 | "100*50等于多少" |

> 默认关闭，不影响现有问答流程。扩展新函数只需在 `src/pipeline/agent.ts` 的 `functions` 数组中注册。

### 6. 启动前端

```bash
cd client
npm install
npm run dev
```

→ 前端地址：http://localhost:5173

### 7. 开始使用

1. 注册账号或使用初始管理员：`admin` / `admin123`
2. 创建知识库
3. 上传文档（支持 PDF / Word / Markdown / TXT）
4. 在知识库中提问

## 项目结构

```
rag_prod/
├── src/                        # 后端源码
│   ├── server.ts               # 入口
│   ├── app.ts                  # Fastify 工厂
│   ├── config.ts               # 环境变量配置
│   ├── db/
│   │   ├── schema.ts           # 数据库表定义（6 实体）
│   │   └── index.ts            # Drizzle 连接
│   ├── lib/
│   │   ├── errors.ts           # 错误类 + 错误处理器
│   │   ├── vectordb.ts         # LanceDB 封装
│   │   └── redis.ts            # Redis 客户端
│   ├── middleware/
│   │   └── auth.ts             # JWT 认证中间件
│   ├── pipeline/
│   │   ├── parser.ts           # 文档解析（PDF/Word/MD/TXT）
│   │   ├── splitter.ts         # 文本切分
│   │   ├── embedder.ts         # Ollama Embedding 调用
│   │   └── generator.ts        # LLM 生成 + 上下文改写
│   ├── services/
│   │   ├── auth.service.ts     # 认证服务
│   │   ├── kb.service.ts       # 知识库 CRUD
│   │   ├── doc.service.ts      # 文档摄入
│   │   ├── retrieval.service.ts # 混合检索
│   │   ├── context.service.ts  # 对话管理
│   │   └── chat.service.ts     # 问答编排
│   └── routes/
│       ├── auth.ts             # /api/auth/*
│       ├── kb.ts               # /api/kb/*
│       ├── doc.ts              # /api/kb/:id/docs/*
│       └── chat.ts             # /api/kb/:id/chat 等
├── client/                     # 前端源码
│   └── src/
│       ├── pages/              # 页面组件
│       ├── components/         # 通用组件
│       ├── composables/        # 可组合函数
│       ├── stores/             # Pinia Store
│       ├── router/             # Vue Router
│       └── lib/                # API 客户端
├── test/                       # 后端测试
├── scripts/                    # 工具脚本
├── docs/                       # 文档
├── docker-compose.yml          # 容器编排
└── package.json
```

## API 端点

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册 | 否 |
| POST | `/api/auth/login` | 登录 | 否 |
| GET | `/api/kb` | 知识库列表 | 是 |
| POST | `/api/kb` | 创建知识库 | 是 |
| GET | `/api/kb/:id` | 知识库详情 | 是 |
| PATCH | `/api/kb/:id` | 编辑知识库 | 是 |
| DELETE | `/api/kb/:id` | 删除知识库 | 是 |
| POST | `/api/kb/:id/docs` | 上传文档 | 是 |
| GET | `/api/kb/:id/docs` | 文档列表 | 是 |
| DELETE | `/api/kb/:id/docs/:docId` | 删除文档 | 是 |
| POST | `/api/kb/:id/chat` | 问答 | 是 |
| GET | `/api/kb/:id/conversations` | 对话列表 | 是 |
| GET | `/api/conversations/:id` | 对话详情 | 是 |
| DELETE | `/api/conversations/:id` | 删除对话 | 是 |
| GET | `/api/health` | 健康检查 | 否 |

## 开发指引

### 添加新路由

1. 在 `src/routes/` 新建文件
2. 实现处理函数，声明 `schema: { body: ... }` 以支持 Swagger
3. 在 `src/app.ts` 的 `register` 调用中注册

### 添加新数据库表

1. 在 `src/db/schema.ts` 定义表结构
2. 运行 `npx drizzle-kit generate` 生成迁移
3. 运行 `npx drizzle-kit migrate` 执行迁移

### 前端开发

```bash
cd client
npm run dev
# 热更新，API 请求自动代理到 localhost:3000
```

### 运行测试

```bash
# 需要 PostgreSQL 和 Redis 在线
npm test
```

### 常用命令

```bash
npm run dev          # 启动后端（热更新）
npm run build        # 编译后端 TypeScript
npm test             # 运行测试
npx drizzle-kit studio  # 数据库可视化管理
```

## 故障排查

### 启动后端报 "connect ECONNREFUSED"

PostgreSQL 或 Redis 没启动。检查：

```bash
docker ps   # 确认 postgres 和 redis 两个容器都在运行
```

如果少了，重新 `docker-compose up -d`。

### 上传文档后永远"处理中"

大概率 Ollama 挂了或模型没拉。检查：

```bash
curl http://localhost:11434/api/tags   # 应返回模型列表含 qwen2.5:7b 和 bge-m3
```

如果 404 或空：确认 Ollama 在运行，且模型已拉取。

### 问答返回 500 错误

查看后端终端的报错日志。常见原因：
- Ollama 离线（`docker ps` 看 ollama 容器状态）
- 模型没拉（见上一条）
- 内存不足（Qwen2.5-7B 需要 ~5GB）

### 前端页面空白

确认后端已启动（`npm run dev`），前端开发服务器已启动（`cd client && npm run dev`）。浏览器打开 F12 → Network 看 API 请求是否报错。

### 想换更小的模型（加速 CPU 推理）

```bash
# 拉更小的模型
docker exec -it rag_prod-ollama-1 ollama pull qwen2.5:3b

# 修改 .env
LLM_MODEL=qwen2.5:3b

# 重启后端
```
> 注意：换 LLM 模型不需要重建向量索引。但换 Embedding 模型需要删掉 `data/lancedb/` 全部重新上传文档。

## 已知限制

| 限制 | 影响 | 缓解 |
|------|------|------|
| CPU 推理慢 | 大文档处理需 5-10 分钟 | 异步处理，不阻塞上传 |
| 无 GPU 加速 | 无 NVIDIA 显卡即走 CPU | 可接云端 LLM API |
| 单机部署 | 不可横向扩展 | 20 人以下够用 |
| 无 Reranker | 检索精度有提升空间 | V2 加 |
| JWT 无过期 | 安全风险 | 短期使用可接受 |

## 参考文档

- [企业级 RAG 知识库架构设计与落地](docs/企业级RAG知识库架构设计与落地.md) — 架构理论
- [架构设计与实现细节](docs/架构设计与实现细节.md) — 项目全貌参考，面向开发者与 AI 扩展
- [迭代开发全记录](docs/迭代开发全记录.md) — V1-V6 完整踩坑记录（23 个）
- [小白部署指南：从本地到上线](docs/小白部署指南-从本地到上线.md) — 零基础部署到云服务器
- [用户指南：从登录到精通](docs/用户指南-从登录到精通.md) — 给使用者的产品说明书
- [功能清单](docs/功能清单.md) — V1/V2 全部功能 + 实现位置索引

## License

MIT
