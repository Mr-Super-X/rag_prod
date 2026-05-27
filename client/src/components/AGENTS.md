<!-- Parent: ../AGENTS.md -->

# components

## Purpose

可复用 Vue 3 UI 组件。每个组件单文件，按功能领域划分。

## Key Files

| File | Description |
|------|-------------|
| `AppLayout.vue` | 全局布局（侧边栏 + 顶栏 + 主内容区） |
| `ChatPanel.vue` | 聊天面板（消息列表 + 输入框 + SSE 流式渲染） |
| `ConversationList.vue` | 对话历史列表 |
| `DocList.vue` | 知识库文档列表（含状态标识） |
| `DocUploader.vue` | 文档上传组件（拖拽/选择 + 进度显示） |
| `MessageBubble.vue` | 单条消息气泡（用户/助手 + 来源标记） |

## For AI Agents

### Working In This Directory

- 纯 UI 组件（无数据获取逻辑），数据通过 props 传入
- 组件文件名和目录名都是 PascalCase
- 每个组件需处理 loading/error/empty 状态展示

### Common Patterns

- `<script setup lang="ts">` + `defineProps<T>()`
- 事件通过 `defineEmits<T>()` 向上传递
- 不在此目录直接调 API，数据由页面层通过 props 传入
