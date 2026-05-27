# Spec: RAG V9 — 对话导出 + 管理员增强

## Metadata
- Spec ID: rag-v9-export-stats-20260527
- Status: completed
- Type: brownfield
- Version: V9

## Goal

支持用户将对话导出为 Markdown 文件，为管理员面板添加知识库使用统计数据。

## Scope

### 对话导出
- 新增导出端点，返回 Markdown 格式的对话内容
- 对话列表添加导出按钮，触发浏览器下载 `.md` 文件
- 导出内容包括：对话标题、时间、每条消息的角色和内容

### 管理员 KB 统计
- 管理员 KB 列表增加文档数和对话数统计列
- 后端 `/api/admin/kbs` 增强：JOIN 查询统计

## Acceptance Criteria
- [x] 用户可从对话列表导出任意对话为 .md 文件
- [x] 导出内容包含完整对话历史
- [x] 管理员可看到每个 KB 的文档数和对话数

## Technical Notes
- 导出复用已有 `getMessages()` 接口
- 统计通过 Drizzle `count()` 聚合实现
