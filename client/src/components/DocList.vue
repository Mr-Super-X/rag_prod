<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { api } from "@/lib/api.js";
import { useAsync } from "@/composables/useAsync.js";
import DocPreviewModal from "./DocPreviewModal.vue";
import type { Document } from "@/types.js";

const props = defineProps<{ kbId: string }>();

const docs = useAsync<Document[]>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
const hasProcessing = ref(false);
const previewDocId = ref("");

onMounted(() => {
  fetchDocs();
  startPolling();
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});

function fetchDocs() {
  docs.execute(() => api.get<Document[]>("/kb/" + props.kbId + "/docs").then((r) => {
    hasProcessing.value = r.data.some((d) => d.status === "processing" || d.status === "queued");
    if (hasProcessing.value) startPolling();
    return r.data;
  }));
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (!hasProcessing.value) {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      return;
    }
    fetchDocs();
  }, 3000);
}

async function handleDelete(docId: string) {
  try {
    await api.delete(`/kb/${props.kbId}/docs/${docId}`);
    fetchDocs();
  } catch { /* ignore */ }
}

function openPreview(docId: string) {
  previewDocId.value = docId;
}

function statusLabel(s: string): string {
  return { queued: "排队中", processing: "处理中", ready: "就绪", error: "失败" }[s] || s;
}

const steps = ["parsing", "splitting", "embedding", "indexing", "ready"] as const;
const stepLabels: Record<string, string> = {
  parsing: "解析", splitting: "切分", embedding: "向量化", indexing: "索引", ready: "就绪",
};

function stepStatus(current: string | null | undefined, step: string): "done" | "current" | "pending" {
  if (!current) return "pending";
  const curIdx = steps.indexOf(current as typeof steps[number]);
  const stepIdx = steps.indexOf(step as typeof steps[number]);
  if (stepIdx < curIdx) return "done";
  if (stepIdx === curIdx) return "current";
  return "pending";
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
        <span v-if="doc.status === 'processing' && doc.progressStep" class="steps-row">
          <span
            v-for="step in steps"
            :key="step"
            class="step-dot"
            :class="stepStatus(doc.progressStep, step)"
          >{{ stepLabels[step] }}</span>
        </span>
        <span class="doc-chunks" v-if="doc.status === 'ready'">{{ doc.chunkCount }} 块</span>
        <span class="doc-error" v-if="doc.status === 'error'">{{ doc.errorMessage }}</span>
        <button v-if="doc.status === 'ready'" class="btn-preview" @click="openPreview(doc.id)">预览</button>
        <button class="btn-del" @click="handleDelete(doc.id)">删除</button>
      </div>
    </div>

    <DocPreviewModal
      v-if="previewDocId"
      :kb-id="kbId"
      :doc-id="previewDocId"
      @close="previewDocId = ''"
    />
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
.doc-name {
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.btn-preview {
  background: transparent; color: var(--color-primary); font-size: 12px; padding: 4px 8px;
}
.btn-preview:hover { background: #eef2ff; }
.doc-type { color: var(--color-text-secondary); font-size: 11px; text-transform: uppercase; }
.doc-status { font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.doc-status.processing { background: #fef3c7; color: #92400e; }
.doc-status.ready { background: #dcfce7; color: #166534; }
.doc-status.error { background: #fef2f2; color: #991b1b; }
.doc-chunks { color: var(--color-text-secondary); font-size: 12px; }
.doc-error { color: var(--color-danger); font-size: 11px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btn-del { background: transparent; color: var(--color-danger); font-size: 12px; padding: 4px 8px; }
.btn-del:hover { background: #fef2f2; }
.steps-row { display: flex; gap: 2px; align-items: center; }
.step-dot {
  font-size: 11px; padding: 1px 6px; border-radius: 8px;
  color: var(--color-text-secondary); background: #f3f4f6;
  transition: all 0.3s;
}
.step-dot.current { color: #92400e; background: #fef3c7; animation: pulse 1.5s infinite; }
.step-dot.done { color: #166534; background: #dcfce7; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
</style>
