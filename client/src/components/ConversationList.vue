<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { api } from "@/lib/api.js";
import { useAsync } from "@/composables/useAsync.js";
import type { Conversation } from "@/types.js";

const props = defineProps<{ kbId: string }>();
const emit = defineEmits<{ select: [convId: string]; newChat: [] }>();

const convs = useAsync<Conversation[]>();
const loadingId = ref<string | null>(null);
const searchKeyword = ref("");

onMounted(() => {
  fetchConvs();
});

function fetchConvs() {
  convs.execute(() => api.get<Conversation[]>(`/kb/${props.kbId}/conversations`).then((r) => r.data));
}

function handleNewChat() {
  emit("newChat");
  fetchConvs();
}

const filteredConvs = computed(() => {
  if (!convs.data.value) return [];
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return convs.data.value;
  return convs.data.value.filter((c) =>
    (c.title || "新对话").toLowerCase().includes(kw),
  );
});

async function downloadExport(convId: string) {
  const rt = localStorage.getItem("refreshToken");
  if (!rt) return;
  const refreshRes = await fetch("/api/auth/refresh", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: rt }),
  });
  if (!refreshRes.ok) return;
  const at = (await refreshRes.json()).data.accessToken;

  const res = await fetch(`/api/conversations/${convId}/export`, {
    headers: { Authorization: `Bearer ${at}` },
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `对话-${convId.slice(0, 8)}.md`; a.click();
  URL.revokeObjectURL(url);
}

async function loadConv(convId: string) {
  loadingId.value = convId;
  try {
    await api.get<Conversation>(`/conversations/${convId}`);
    emit("select", convId);
  } catch { /* ignore */ }
  loadingId.value = null;
}

const deletingId = ref<string | null>(null);

async function deleteConv(convId: string) {
  if (!confirm("确定要删除这条对话记录吗？")) return;
  deletingId.value = convId;
  try {
    await api.delete(`/conversations/${convId}`);
    fetchConvs();
  } catch { /* ignore */ }
  deletingId.value = null;
}
</script>

<template>
  <div class="conv-list">
    <div class="conv-header">
      <h4>对话历史</h4>
      <button class="btn-new" @click="handleNewChat">+ 新对话</button>
    </div>

    <input
      v-model="searchKeyword"
      class="search-input"
      type="text"
      placeholder="搜索对话..."
    />

    <div v-if="convs.loading.value" class="state">加载中...</div>
    <div v-else-if="!filteredConvs || filteredConvs.length === 0" class="state">
      {{ searchKeyword ? "无匹配对话" : "暂无对话" }}
    </div>

    <div v-else class="list">
      <button
        v-for="conv in filteredConvs"
        :key="conv.id"
        class="conv-item"
        :class="{ active: loadingId === conv.id }"
        @click="loadConv(conv.id)"
      >
        <span class="conv-title">{{ conv.title || "新对话" }}</span>
        <div class="conv-row">
          <span class="conv-date">{{ new Date(conv.updatedAt).toLocaleDateString("zh-CN") }}</span>
          <div class="conv-actions">
            <button class="conv-export" title="导出为 Markdown" @click.stop="downloadExport(conv.id)">⬇</button>
            <button class="conv-delete" title="删除对话" @click.stop="deleteConv(conv.id)">×</button>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.conv-list { display: flex; flex-direction: column; gap: 8px; }
.conv-header { display: flex; align-items: center; justify-content: space-between; }
h4 { font-size: 15px; font-weight: 600; }
.btn-new { font-size: 12px; padding: 4px 10px; background: var(--color-primary); color: #fff; }
.btn-new:hover { background: var(--color-primary-hover); }
.search-input {
  width: 100%; padding: 6px 10px; font-size: 13px;
  border: 1px solid var(--color-border); border-radius: var(--radius);
  background: var(--color-bg);
}
.search-input:focus { border-color: var(--color-primary); outline: none; }
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
.conv-row { display: flex; align-items: center; justify-content: space-between; }
.conv-date { font-size: 11px; color: var(--color-text-secondary); }
.conv-actions { display: flex; align-items: center; gap: 4px; }
.conv-export { font-size: 11px; color: var(--color-primary); background: transparent; padding: 2px 4px; border-radius: 4px; }
.conv-export:hover { background: #eef2ff; }
.conv-delete { font-size: 14px; color: #999; background: transparent; padding: 0 4px; border-radius: 4px; line-height: 1; }
.conv-delete:hover { color: #e53e3e; background: #fff5f5; }
</style>
