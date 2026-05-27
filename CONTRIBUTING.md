# CONTRIBUTING

本文档描述本地开发环境搭建、编码规范和 PR 流程。

## 本地开发环境

### 前置条件

- Node.js >= 20
- Docker（运行 PostgreSQL 15 + Redis 7 + Ollama）

### 首次搭建

```bash
# 1. 克隆仓库
git clone <repo-url> && cd rag_prod

# 2. 启动基础设施
docker-compose up -d

# 3. 拉取模型（仅首次，需要 VPN）
docker exec -it rag_prod-ollama-1 ollama pull qwen2.5:7b
docker exec -it rag_prod-ollama-1 ollama pull bge-m3

# 4. 创建 .env（从 .env.example 复制并修改 JWT_SECRET）
cp .env.example .env

# 5. 初始化数据库
npm install
npx drizzle-kit generate
npx drizzle-kit migrate

# 6. 启动后端
npm run dev

# 7. 启动前端（新终端）
cd client && npm install && npm run dev
```

### 日常开发

```bash
# 启动基础设施
docker-compose up -d

# 启动后端（热更新）
npm run dev

# 启动前端（热更新，另一个终端）
cd client && npm run dev
```

## 分支规范

| 分支类型 | 命名格式 | 用途 |
|----------|---------|------|
| 功能分支 | `feat/<描述>` 或 `feature/<描述>` | 新功能开发 |
| 修复分支 | `fix/<描述>` | Bug 修复 |
| 重构分支 | `refactor/<描述>` | 代码重构 |

## 提交规范

使用约定式提交（Conventional Commits）：

```
<type>: <描述>

feat: 添加知识库成员管理功能
fix: 修复流式输出断连问题
refactor: 重构检索服务 RRF 融合逻辑
docs: 更新 README 部署指南
test: 添加 auth 模块集成测试
chore: 升级依赖版本
```

## 编码规范

本项目遵循 `~/.claude/rules/` 下的规则体系，核心要点：

- **TypeScript 严格模式**：禁用 `any`，用 `unknown` + 类型守卫
- **文件行限**：单文件 ≤ 400 行，前端组件 ≤ 300 行，展示组件 ≤ 200 行
- **函数行限**：单一函数 ≤ 80 行
- **不可变性**：始终创建新对象，不修改现有对象
- **错误处理**：后端用 `AppError` 子类，前端异步组件处理 Loading/Error/Empty 三态
- **API 格式**：统一 `{ success: boolean, data?: T, error?: { code, message } }`
- **Zod 校验**：用户输入用 Zod schema 校验，类型从 schema 推断
- **注释原则**：只写 Why，不写 What

详见项目根目录 `CLAUDE.md` 和 `AGENTS.md`。

## 添加新功能

### 后端

1. 如需新建表 → 在 `src/db/schema.ts` 定义 → `npx drizzle-kit generate` → `npx drizzle-kit migrate`
2. 新增服务 → 在 `src/services/` 创建文件
3. 新增路由 → 在 `src/routes/` 创建文件，导出 `async function xxxRoutes(app: FastifyInstance)`
4. 在 `src/app.ts` 中 `app.register(xxxRoutes)` 注册
5. 写测试 → `test/` 目录
6. 更新 `docs/功能清单.md` 中的功能表格

### 前端

1. 新增页面 → `client/src/pages/`，在 `client/src/router/index.ts` 注册路由
2. 新增组件 → `client/src/components/`
3. 新增状态 → `client/src/stores/`
4. API 调用经 `client/src/lib/api.ts` 封装的 `api` 对象

## 测试

```bash
# 需要 PG + Redis 在线
npm test

# 交互式 watch 模式
npm run test:watch
```

测试配置见 `vitest.config.ts`，测试用独立数据库 `ragtest`。

## 文档联动

修改功能后需要同步更新的文档：

| 变更类型 | 需更新文档 |
|----------|-----------|
| 新功能/API 变更 | `docs/功能清单.md` + `CHANGELOG.md` |
| 架构变更 | `docs/架构设计与实现细节.md` |
| 部署流程变更 | README.md |
| 配置项变更 | `.env.example` + `src/config.ts`（Zod schema） |
