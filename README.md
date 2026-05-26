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
   │  元数据    │              │  LLM+Embedding│       │  缓存+B25 │
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

> **注意**：模型文件托管在 Docker Hub（`ollama/ollama`）和 Ollama 官方 registry，国内网络直连经常超时或中断。如果下载失败，需要：
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
- [V1 开发实录：从方案到落地](docs/V1开发实录-从方案到落地.md) — 完整踩坑记录（16 个）
- [小白部署指南：从本地到上线](docs/小白部署指南-从本地到上线.md) — 零基础部署到云服务器

## License

MIT
