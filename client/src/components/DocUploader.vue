<script setup lang="ts">
import { ref } from "vue";
import { api } from "@/lib/api.js";

const props = defineProps<{ kbId: string }>();
const emit = defineEmits<{ uploaded: [] }>();

const uploading = ref(false);
const error = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  uploading.value = true;
  error.value = "";
  try {
    await api.upload(`/kb/${props.kbId}/docs`, formData);
    emit("uploaded");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "上传失败";
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
}

function triggerInput() {
  fileInput.value?.click();
}
</script>

<template>
  <div class="uploader">
    <input
      ref="fileInput"
      type="file"
      accept=".pdf,.docx,.md,.txt"
      style="display:none"
      @change="handleFileChange"
    />
    <button class="btn-upload" :disabled="uploading" @click="triggerInput">
      {{ uploading ? "上传中..." : "+ 上传文档" }}
    </button>
    <span class="hint">支持 PDF / Word / Markdown / TXT</span>
    <div v-if="error" class="error-msg">{{ error }}</div>
  </div>
</template>

<style scoped>
.uploader { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.btn-upload {
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  color: var(--color-primary);
  padding: 8px 16px;
  font-size: 14px;
}
.btn-upload:hover { border-color: var(--color-primary); background: #eef2ff; }
.btn-upload:disabled { opacity: 0.5; }
.hint { font-size: 12px; color: var(--color-text-secondary); }
.error-msg { width: 100%; background: #fef2f2; color: var(--color-danger); padding: 6px 10px; border-radius: var(--radius); font-size: 13px; }
</style>
