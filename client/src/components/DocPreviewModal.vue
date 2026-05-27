<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { api } from "@/lib/api.js";

const props = defineProps<{ kbId: string; docId: string }>();
const emit = defineEmits<{ close: [] }>();

interface PreviewData {
  text: string;
  filename: string;
  fileType: string;
  totalChunks: number;
  hasMore: boolean;
}

const modalRef = ref<HTMLElement | null>(null);
const loading = ref(true);
const error = ref("");
const data = ref<PreviewData | null>(null);
const offset = ref(0);
const limit = 50;

onMounted(() => { modalRef.value?.focus(); });

async function fetchPreview(reset = false) {
  if (reset) { offset.value = 0; loading.value = true; error.value = ""; }
  try {
    const res = await api.get<PreviewData>(
      `/kb/${props.kbId}/docs/${props.docId}/preview?offset=${offset.value}&limit=${limit}`,
    );
    if (reset) {
      data.value = res.data;
    } else {
      data.value = {
        ...res.data,
        text: (data.value?.text || "") + "\n\n" + res.data.text,
      };
    }
    offset.value += limit;
  } catch (err: unknown) {
    const e = err as { error?: { message?: string } };
    error.value = e?.error?.message || "加载失败";
  }
  loading.value = false;
}

function loadMore() {
  fetchPreview(false);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}

watch(() => props.docId, () => fetchPreview(true), { immediate: true });
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')" @keydown="onKeydown">
    <div class="modal-body" ref="modalRef" tabindex="-1">
      <div class="modal-header">
        <h3>{{ data?.filename || "文档预览" }}</h3>
        <button class="btn-close" @click="emit('close')">✕</button>
      </div>

      <div class="modal-content" tabindex="0" @keydown="onKeydown">
        <!-- Loading -->
        <div v-if="loading" class="state">加载中...</div>

        <!-- Error -->
        <div v-else-if="error" class="state error">
          <p>{{ error }}</p>
          <button class="btn-retry" @click="fetchPreview(true)">重试</button>
        </div>

        <!-- Empty -->
        <div v-else-if="!data || !data.text" class="state">此文档无内容</div>

        <!-- Content -->
        <template v-else>
          <pre class="doc-text">{{ data.text }}</pre>
          <div v-if="data.hasMore" class="load-more">
            <button class="btn-load" :disabled="loading" @click="loadMore">
              {{ loading ? "加载中..." : "加载更多" }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal-body {
  background: var(--color-surface); border-radius: 12px;
  width: min(720px, 90vw); max-height: 80vh; display: flex; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--color-border);
}
.modal-header h3 { font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btn-close {
  background: transparent; font-size: 18px; color: var(--color-text-secondary);
  padding: 4px 8px; line-height: 1;
}
.btn-close:hover { color: var(--color-text); }
.modal-content {
  flex: 1; overflow-y: auto; padding: 20px; outline: none;
}
.state { text-align: center; padding: 40px 20px; color: var(--color-text-secondary); font-size: 14px; }
.state.error { color: var(--color-danger); }
.btn-retry { margin-top: 8px; background: var(--color-primary); color: #fff; padding: 6px 16px; font-size: 13px; }
.doc-text {
  white-space: pre-wrap; word-break: break-word;
  font-size: 14px; line-height: 1.8; font-family: inherit; margin: 0;
}
.load-more { text-align: center; padding: 16px 0; }
.btn-load {
  background: transparent; color: var(--color-primary); padding: 6px 20px;
  font-size: 13px; border: 1px solid var(--color-primary);
}
.btn-load:hover { background: #eef2ff; }
.btn-load:disabled { opacity: 0.5; }
</style>
