<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "@/lib/api.js";

interface ErrorDoc {
  docId: string; kbId: string; kbName: string;
  filename: string; uploaderUsername: string;
  errorMessage: string; createdAt: string;
}

const docs = ref<ErrorDoc[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const retrying = ref<Set<string>>(new Set());

async function loadErrorDocs() {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.get<ErrorDoc[]>("/admin/error-docs");
    docs.value = res.data;
  } catch {
    error.value = "加载失败文档列表失败";
  } finally {
    loading.value = false;
  }
}

async function retryDoc(doc: ErrorDoc) {
  retrying.value.add(doc.docId);
  try {
    await api.post(`/kb/${doc.kbId}/docs/${doc.docId}/retry`);
    docs.value = docs.value.filter((d) => d.docId !== doc.docId);
  } catch {
    // 重试失败不处理，保留在列表中
  } finally {
    retrying.value.delete(doc.docId);
  }
}

onMounted(loadErrorDocs);
</script>

<template>
  <div class="admin-error-docs">
    <div v-if="loading" class="state-msg">加载中...</div>
    <div v-else-if="error" class="state-msg error">{{ error }}</div>
    <div v-else-if="docs.length === 0" class="state-msg">暂无失败文档</div>
    <table v-else class="error-table">
      <thead>
        <tr>
          <th>文件名</th>
          <th>知识库</th>
          <th>上传者</th>
          <th>失败原因</th>
          <th>时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="doc in docs" :key="doc.docId">
          <td class="fn-cell">{{ doc.filename }}</td>
          <td>{{ doc.kbName }}</td>
          <td>{{ doc.uploaderUsername }}</td>
          <td class="err-cell">{{ doc.errorMessage }}</td>
          <td>{{ new Date(doc.createdAt).toLocaleString("zh-CN") }}</td>
          <td>
            <button
              class="btn-retry"
              :disabled="retrying.has(doc.docId)"
              @click="retryDoc(doc)"
            >{{ retrying.has(doc.docId) ? "处理中..." : "重试" }}</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.admin-error-docs { width: 100%; }
.state-msg { text-align: center; padding: 40px; color: var(--color-text-secondary); }
.state-msg.error { color: #ef4444; }
.error-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.error-table th, .error-table td { padding: 8px 10px; border-bottom: 1px solid var(--color-border); text-align: left; }
.error-table th { font-weight: 600; color: var(--color-text-secondary); font-size: 12px; }
.fn-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.err-cell { max-width: 250px; color: #ef4444; font-size: 12px; }
.btn-retry {
  padding: 4px 12px; border-radius: 4px; font-size: 12px;
  background: var(--color-primary); color: #fff; border: none; cursor: pointer;
}
.btn-retry:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
