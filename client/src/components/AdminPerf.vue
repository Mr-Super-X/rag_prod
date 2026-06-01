<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "@/lib/api.js";

interface PerfStats { hits: number; misses: number; total: number; hitRate: string }

const stats = ref<PerfStats>({ hits: 0, misses: 0, total: 0, hitRate: "0" });
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  loading.value = true; error.value = null;
  try {
    const res = await api.get<PerfStats>("/admin/perf-stats");
    stats.value = res.data;
  } catch { error.value = "加载失败"; }
  finally { loading.value = false; }
}

onMounted(load);
</script>

<template>
  <div class="admin-perf">
    <div v-if="loading" class="st">加载中...</div>
    <div v-else-if="error" class="st err">{{ error }}</div>
    <div v-else class="cards">
      <div class="card"><span class="num">{{ stats.hitRate }}%</span><span class="lbl">缓存命中率</span></div>
      <div class="card"><span class="num">{{ stats.hits }}</span><span class="lbl">缓存命中</span></div>
      <div class="card"><span class="num">{{ stats.misses }}</span><span class="lbl">缓存未命中</span></div>
      <div class="card"><span class="num">{{ stats.total }}</span><span class="lbl">总查询</span></div>
    </div>
    <p class="hint">Reranker: Cross-Encoder (BGE-Reranker-v2-m3)，LLM listwise 为 fallback。缓存 TTL: 24h，文档更新时自动失效。</p>
  </div>
</template>

<style scoped>
.admin-perf { width: 100%; }
.st { text-align: center; padding: 40px; color: var(--color-text-secondary); }
.st.err { color: #ef4444; }
.cards { display: flex; gap: 16px; flex-wrap: wrap; }
.card { background: var(--color-bg); border-radius: var(--radius); padding: 20px; min-width: 140px; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.num { font-size: 28px; font-weight: 700; color: var(--color-primary); }
.lbl { font-size: 13px; color: var(--color-text-secondary); }
.hint { margin-top: 16px; font-size: 12px; color: var(--color-text-secondary); }
</style>
