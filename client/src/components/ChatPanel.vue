<script setup lang="ts">
import { ref, nextTick, watch } from "vue";
import { streamChat, api } from "@/lib/api.js";
import MessageBubble from "./MessageBubble.vue";
import type { Message, ChunkSource, Conversation } from "@/types.js";

const props = defineProps<{ kbId: string; loadConvId?: string }>();

const messages = ref<Message[]>([]);
const question = ref("");
const loading = ref(false);
const thinking = ref("");
const error = ref("");
const convId = ref<string | null>(null);
const messagesEl = ref<HTMLElement | null>(null);

// 加载历史对话
watch(
  () => props.loadConvId,
  async (id) => {
    if (!id) return;
    try {
      const res = await api.get<Conversation>(`/conversations/${id}`);
      const conv = res.data;
      messages.value = (conv.messages || []).map((m) => ({
        id: m.id, role: m.role as "user" | "assistant",
        content: m.content, sources: m.sources, createdAt: m.createdAt,
      }));
      convId.value = conv.id;
    } catch { /* ignore */ }
  },
  { immediate: true },
);

watch(
  () => props.kbId,
  () => {
    messages.value = [];
    convId.value = null;
    error.value = "";
  },
);

async function send() {
  const q = question.value.trim();
  if (!q || loading.value) return;

  question.value = "";
  loading.value = true;
  thinking.value = "正在检索...";
  const phaseTimer1 = setTimeout(() => { if (loading.value) thinking.value = "正在分析..."; }, 1500);
  const phaseTimer2 = setTimeout(() => { if (loading.value) thinking.value = "正在生成..."; }, 4000);
  error.value = "";

  messages.value.push({
    id: Date.now().toString(),
    role: "user",
    content: q,
    sources: null,
    createdAt: new Date().toISOString(),
  });
  await scrollDown();

  // 创建占位 assistant 消息，用于流式填充
  const assistantMsgId = (Date.now() + 1).toString();
  messages.value.push({
    id: assistantMsgId,
    role: "assistant",
    content: "",
    sources: null,
    createdAt: new Date().toISOString(),
  });

  const assistantMsg = messages.value.find((m) => m.id === assistantMsgId)!;

  streamChat(
    props.kbId,
    q,
    convId.value || undefined,
    (token) => {
      if (thinking.value) { thinking.value = ""; clearTimeout(phaseTimer1); clearTimeout(phaseTimer2); }
      assistantMsg.content += token;
      scrollDown();
    },
    (result) => {
      thinking.value = "";
      convId.value = result.conversationId;
      assistantMsg.sources = result.sources as ChunkSource[];
      if (result.answer) {
        assistantMsg.content = result.answer;
      } else if (result.agent) {
        assistantMsg.content = result.answer || "";
      } else if (result.fallback) {
        assistantMsg.content = result.answer || "";
      }
      loading.value = false;
    },
    (err) => {
      thinking.value = "";
      error.value = err.message || "问答失败";
      loading.value = false;
    },
  );
}

async function scrollDown() {
  await nextTick();
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
  }
}
</script>

<template>
  <div class="chat-panel">
    <div ref="messagesEl" class="messages">
      <div v-if="messages.length === 0" class="empty-hint">
        <p>在下方输入问题，基于知识库文档获取答案</p>
      </div>

      <MessageBubble
        v-for="msg in messages"
        :key="msg.id"
        :role="msg.role"
        :content="msg.content"
        :sources="msg.sources"
        :created-at="msg.createdAt"
        :message-id="msg.role === 'assistant' ? msg.id : undefined"
      />

      <div v-if="thinking" class="thinking">
        <span class="dot"></span> {{ thinking }}
      </div>
      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <div class="input-row">
      <input
        v-model="question"
        type="text"
        placeholder="输入问题，按回车发送"
        @keydown.enter="send"
        :disabled="loading"
      />
      <button class="btn-send" :disabled="loading || !question.trim()" @click="send">
        发送
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  display: flex; flex-direction: column; height: calc(100vh - 200px);
  border: 1px solid var(--color-border); border-radius: 12px;
  background: var(--color-surface); overflow: hidden;
}
.messages {
  flex: 1; overflow-y: auto; padding: 20px;
}
.empty-hint { text-align: center; padding: 60px 20px; color: var(--color-text-secondary); font-size: 14px; }
.typing { font-size: 13px; color: var(--color-text-secondary); padding: 8px 0; }
.thinking { font-size: 13px; color: var(--color-primary); padding: 8px 0; display: flex; align-items: center; gap: 6px; }
.dot { width: 6px; height: 6px; background: var(--color-primary); border-radius: 50%; animation: pulse 1s infinite; }
@keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
.error-msg { background: #fef2f2; color: var(--color-danger); padding: 8px 12px; border-radius: var(--radius); font-size: 13px; margin: 8px 0; }
.input-row {
  display: flex; gap: 8px; padding: 12px 16px;
  border-top: 1px solid var(--color-border); background: var(--color-bg);
}
.input-row input { flex: 1; }
.btn-send {
  background: var(--color-primary); color: #fff;
  padding: 8px 20px; font-size: 14px; white-space: nowrap;
}
.btn-send:disabled { opacity: 0.5; }
.btn-send:hover:not(:disabled) { background: var(--color-primary-hover); }
</style>
