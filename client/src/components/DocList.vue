<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "@/lib/api.js";
import { useAsync } from "@/composables/useAsync.js";
import type { Document } from "@/types.js";

const props = defineProps<{ kbId: string }>();

const docs = useAsync<Document[]>();

onMounted(() => fetchDocs());

function fetchDocs() {
  docs.execute(() => api.get<Document[]>("/kb/" + props.kbId + "/docs").then((r) => r.data));
}

async function handleDelete(docId: string) {
  try {
    await api.delete(`/kb/${props.kbId}/docs/${docId}`);
    fetchDocs();
  } catch { /* ignore */ }
}

function statusLabel(s: string): string {
  return { queued: "排队中", processing: "处理中", ready: "就绪", error: "失败" }[s] || s;
}
</script>

<template>
  <div class="doc-list">
    <h4>已上传文档</h4>

    <div v-if="docs.loading.value" class="state">加载中...</div>
    <div v-else-if="docs.error.value" class="state error">{{ docs.error.value }}</div>
    <div v-else-if="!docs.data.value || docs.data.value.length === 0" class="state">暂无文档</div>

    <div v-else class="table-wrap">
      <div v-for="doc in docs.data.value" :key="doc.id" class="doc-row">
        <span class="doc-name">{{ doc.filename }}</span>
        <span class="doc-type">{{ doc.fileType }}</span>
        <span class="doc-status" :class="doc.status">{{ statusLabel(doc.status) }}</span>
        <span class="doc-chunks" v-if="doc.status === 'ready'">{{ doc.chunkCount }} 块</span>
        <span class="doc-error" v-if="doc.status === 'error'">{{ doc.errorMessage }}</span>
        <button class="btn-del" @click="handleDelete(doc.id)">删除</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.doc-list { display: flex; flex-direction: column; gap: 12px; }
h4 { font-size: 15px; font-weight: 600; }
.state { color: var(--color-text-secondary); font-size: 14px; padding: 20px 0; }
.state.error { color: var(--color-danger); }
.table-wrap { display: flex; flex-direction: column; gap: 4px; }
.doc-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; background: var(--color-bg); border-radius: var(--radius);
  font-size: 13px;
}
.doc-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-type { color: var(--color-text-secondary); font-size: 11px; text-transform: uppercase; }
.doc-status { font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.doc-status.processing { background: #fef3c7; color: #92400e; }
.doc-status.ready { background: #dcfce7; color: #166534; }
.doc-status.error { background: #fef2f2; color: #991b1b; }
.doc-chunks { color: var(--color-text-secondary); font-size: 12px; }
.doc-error { color: var(--color-danger); font-size: 11px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btn-del { background: transparent; color: var(--color-danger); font-size: 12px; padding: 4px 8px; }
.btn-del:hover { background: #fef2f2; }
</style>
