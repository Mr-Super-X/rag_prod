<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "@/lib/api.js";
import { useAsync } from "@/composables/useAsync.js";
import type { Conversation } from "@/types.js";

const props = defineProps<{ kbId: string }>();
const emit = defineEmits<{ select: [convId: string] }>();

const convs = useAsync<Conversation[]>();
const loadingId = ref<string | null>(null);

onMounted(() => fetchConvs());

function fetchConvs() {
  convs.execute(() => api.get<Conversation[]>(`/kb/${props.kbId}/conversations`).then((r) => r.data));
}

async function loadConv(convId: string) {
  loadingId.value = convId;
  try {
    const r = await api.get<Conversation>(`/conversations/${convId}`);
    emit("select", convId);
    // 将消息传递给父组件
    const conv = r.data;
    if (conv.messages) {
      // handled by parent via event + fetch
    }
  } catch { /* ignore */ }
  loadingId.value = null;
}
</script>

<template>
  <div class="conv-list">
    <h4>对话历史</h4>

    <div v-if="convs.loading.value" class="state">加载中...</div>
    <div v-else-if="!convs.data.value || convs.data.value.length === 0" class="state">暂无对话</div>

    <div v-else class="list">
      <button
        v-for="conv in convs.data.value"
        :key="conv.id"
        class="conv-item"
        :class="{ active: loadingId === conv.id }"
        @click="loadConv(conv.id)"
      >
        <span class="conv-title">{{ conv.title || "新对话" }}</span>
        <span class="conv-date">{{ new Date(conv.updatedAt).toLocaleDateString("zh-CN") }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.conv-list { display: flex; flex-direction: column; gap: 8px; }
h4 { font-size: 15px; font-weight: 600; }
.state { color: var(--color-text-secondary); font-size: 13px; padding: 16px 0; }
.list { display: flex; flex-direction: column; gap: 4px; }
.conv-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 10px 12px; background: var(--color-bg); border-radius: var(--radius);
  text-align: left; font-size: 13px; width: 100%;
}
.conv-item:hover { background: #eef2ff; }
.conv-item.active { background: #e0e7ff; }
.conv-title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.conv-date { font-size: 11px; color: var(--color-text-secondary); }
</style>
