<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "@/lib/api.js";

interface BenchmarkResult {
  question: string;
  answer: string;
  latencyMs: number;
}
interface KB { id: string; name: string }

const kbs = ref<KB[]>([]);
const kbId = ref("");
const questions = ref([
  "什么是RAG？",
  "知识库的核心组成部分有哪些？",
  "向量检索和关键词检索有什么区别？",
  "如何评估RAG系统的性能？",
  "什么是嵌入模型？",
]);
const running = ref(false);
const before = ref<BenchmarkResult[]>([]);
const after = ref<BenchmarkResult[]>([]);
const runLabel = ref<"before" | "after">("before");

onMounted(async () => {
  try {
    const res = await api.get<KB[]>("/admin/kbs");
    kbs.value = res.data;
    if (kbs.value.length > 0) kbId.value = kbs.value[0].id;
  } catch { /* KB 列表加载失败不阻断 */ }
});

async function run() {
  if (!kbId.value) return;
  running.value = true;
  try {
    const qs = questions.value.filter((q) => q.trim());
    const res = await api.post<BenchmarkResult[]>("/admin/ai-engine/benchmark", {
      kbId: kbId.value,
      questions: qs,
    });
    if (runLabel.value === "before") {
      before.value = res.data;
      runLabel.value = "after";
    } else {
      after.value = res.data;
      runLabel.value = "before";
    }
  } catch (err) {
    alert(err instanceof Error ? err.message : "运行失败");
  } finally {
    running.value = false;
  }
}

function summary(text: string): string {
  return text.length > 60 ? text.slice(0, 60) + "…" : text;
}

function diff(idx: number): number | null {
  const b = before.value[idx]?.latencyMs;
  const a = after.value[idx]?.latencyMs;
  if (b == null || a == null) return null;
  return a - b;
}

function hasAnyResults(): boolean {
  return before.value.length > 0 || after.value.length > 0;
}
</script>

<template>
  <div class="bench">
    <div class="bench-controls">
      <select v-model="kbId">
        <option value="" disabled>选择知识库</option>
        <option v-for="k in kbs" :key="k.id" :value="k.id">{{ k.name }}</option>
      </select>
      <button :disabled="running || !kbId" @click="run">
        {{ running ? "运行中…" : "运行基准" + (before.length > 0 ? "（对比）" : "") }}
      </button>
      <button
        v-if="hasAnyResults()"
        class="btn-reset"
        @click="before = []; after = []; runLabel = 'before'"
      >
        重置
      </button>
    </div>

    <div class="bench-questions">
      <div v-for="(q, i) in questions" :key="i" class="bench-question-row">
        <span>Q{{ i + 1 }}</span>
        <input v-model="questions[i]" />
      </div>
    </div>

    <table v-if="hasAnyResults()">
      <thead>
        <tr>
          <th>#</th>
          <th>问题</th>
          <th>回答摘要</th>
          <th v-if="before.length">基准延迟</th>
          <th v-if="after.length">对比延迟</th>
          <th v-if="before.length && after.length">差异</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(q, i) in questions" :key="i">
          <td>{{ i + 1 }}</td>
          <td class="q-cell">{{ q.slice(0, 30) }}</td>
          <td class="a-cell">{{ summary(before[i]?.answer ?? after[i]?.answer ?? "") }}</td>
          <td v-if="before.length">{{ before[i]?.latencyMs ?? "-" }}ms</td>
          <td v-if="after.length">{{ after[i]?.latencyMs ?? "-" }}ms</td>
          <td v-if="before.length && after.length">
            <span v-if="diff(i) != null" :class="diff(i)! < 0 ? 'better' : 'worse'">
              {{ diff(i)! > 0 ? "+" : "" }}{{ diff(i) }}ms
            </span>
            <span v-else>-</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.bench { display: flex; flex-direction: column; gap: 16px; }
.bench-controls { display: flex; gap: 10px; align-items: center; }
.bench-controls select { padding: 6px 10px; border-radius: var(--radius); border: 1px solid var(--color-border); font-size: 14px; }
.bench-controls button { padding: 8px 16px; background: var(--color-primary); color: #fff; border-radius: var(--radius); font-size: 14px; }
.bench-controls button:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-reset { background: var(--color-bg) !important; color: var(--color-text-secondary) !important; border: 1px solid var(--color-border) !important; }
.bench-questions { display: flex; flex-direction: column; gap: 8px; }
.bench-question-row { display: flex; align-items: center; gap: 8px; }
.bench-question-row span { font-weight: 600; font-size: 13px; min-width: 28px; color: var(--color-text-secondary); }
.bench-question-row input { flex: 1; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 14px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--color-border); }
th { font-weight: 600; color: var(--color-text-secondary); font-size: 12px; }
.q-cell { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.a-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text-secondary); }
.better { color: #16a34a; font-weight: 600; }
.worse { color: var(--color-danger); font-weight: 600; }
</style>
