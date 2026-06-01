<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { api, getAccessToken } from "@/lib/api.js";

interface AIConfig { embeddingModel: string; llmProvider: string; llmModel: string; deepseekModel: string; deepseekKeyMasked: string; ollamaUrl: string }
interface KbInfo { id: string; name: string; migrationStatus: string }

const models = ref<string[]>([]);
const config = ref<AIConfig | null>(null);
const kbs = ref<KbInfo[]>([]);
const selectedModel = ref("");

const loading = ref(true);
const error = ref<string | null>(null);
const saving = ref(false);
const saveMsg = ref("");

const llmProvider = ref("ollama");
const llmModel = ref("");
const deepseekModel = ref("deepseek-chat");
const apiKey = ref("");

const migratingKb = ref<string | null>(null);
const migrated = ref(0);
const migTotal = ref(0);
const migErr = ref<string | null>(null);
let abortCtrl: AbortController | null = null;

const migPct = computed(() => migTotal.value > 0 ? Math.round((migrated.value / migTotal.value) * 100) : 0);

async function loadAll() {
  loading.value = true; error.value = null;
  try {
    const [mRes, cRes, kRes] = await Promise.all([
      api.get<string[]>("/admin/ai-engine/models"),
      api.get<AIConfig>("/admin/ai-engine/config"),
      api.get<KbInfo[]>("/admin/kbs"),
    ]);
    models.value = mRes.data;
    config.value = cRes.data;
    kbs.value = kRes.data;
    selectedModel.value = cRes.data.embeddingModel;
    llmProvider.value = cRes.data.llmProvider;
    llmModel.value = cRes.data.llmModel;
    deepseekModel.value = cRes.data.deepseekModel;
  } catch { error.value = "加载 AI 引擎配置失败"; }
  finally { loading.value = false; }
}

async function saveCfg() {
  saving.value = true; saveMsg.value = "";
  try {
    const p: Record<string, string> = {};
    if (selectedModel.value !== config.value?.embeddingModel) p.embeddingModel = selectedModel.value;
    if (llmProvider.value !== config.value?.llmProvider) p.llmProvider = llmProvider.value;
    if (llmModel.value !== config.value?.llmModel) p.llmModel = llmModel.value;
    if (deepseekModel.value !== config.value?.deepseekModel) p.deepseekModel = deepseekModel.value;
    if (apiKey.value) p.apiKey = apiKey.value;
    const res = await api.post<{ needRestart: boolean }>("/admin/ai-engine/config", p);
    saveMsg.value = res.data.needRestart ? "已保存。模型变更需重启后端" : "已保存，即刻生效";
    loadAll();
  } catch { saveMsg.value = "保存失败"; }
  finally { saving.value = false; }
}

async function startMig(kbId: string) {
  if (migratingKb.value) return;
  migratingKb.value = kbId; migErr.value = null; migrated.value = 0; migTotal.value = 0;
  try { await api.post(`/admin/ai-engine/migrate/${kbId}`); sseListen(kbId); }
  catch { migratingKb.value = null; migErr.value = "启动迁移失败"; }
}

function sseListen(kbId: string) {
  abortCtrl = new AbortController();
  const token = getAccessToken();
  fetch(`/api/admin/ai-engine/migrate/${kbId}/progress`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: "text/event-stream" },
    signal: abortCtrl.signal,
  }).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body!.getReader(); const decoder = new TextDecoder(); let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() || "";
      for (const l of lines) {
        if (!l.startsWith("data: ")) continue;
        try {
          const d = JSON.parse(l.slice(6));
          if (d.done) { migratingKb.value = null; abortCtrl?.abort(); loadAll(); }
          else { migrated.value = d.completed; migTotal.value = d.total; }
        } catch { /* skip */ }
      }
    }
  }).catch((e: unknown) => { if ((e as Error).name !== "AbortError") { migratingKb.value = null; migErr.value = "连接中断"; } });
}

onMounted(loadAll);
onUnmounted(() => abortCtrl?.abort());
</script>

<template>
  <div class="ai-engine">
    <div v-if="loading" class="st">加载中...</div>
    <div v-else-if="error" class="st err">{{ error }}</div>
    <template v-else>
      <section class="sec"><h4>Embedding 模型</h4>
        <p class="hint">切换后需重启后端，已上传文档需重建向量</p>
        <select v-model="selectedModel" class="sel"><option v-for="m in models" :key="m" :value="m">{{ m }}</option></select>
      </section>
      <section class="sec"><h4>LLM Provider</h4>
        <div class="fr"><label>Provider</label><select v-model="llmProvider" class="inp"><option value="ollama">Ollama</option><option value="deepseek">DeepSeek</option></select></div>
        <div class="fr"><label>模型名</label><input v-model="llmModel" class="inp" placeholder="qwen2.5:7b" /></div>
        <template v-if="llmProvider === 'deepseek'">
          <div class="fr"><label>DeepSeek 模型</label><input v-model="deepseekModel" class="inp" placeholder="deepseek-chat" /></div>
          <div class="fr"><label>API Key</label><input v-model="apiKey" type="password" class="inp" placeholder="sk-..." /></div>
        </template>
        <p class="hint">LLM Provider 切换即时生效</p>
      </section>
      <div class="bar"><button class="bs" :disabled="saving" @click="saveCfg">{{ saving ? "保存中..." : "保存配置" }}</button><span v-if="saveMsg" :class="['sm', saveMsg.includes('失败') ? 'se' : '']">{{ saveMsg }}</span></div>

      <section class="sec"><h4>向量迁移</h4>
        <p class="hint">切换 Embedding 后对每个 KB 重建向量。迁移期间暂停上传。</p>
        <div v-if="kbs.length === 0" class="st">暂无知识库</div>
        <div v-for="kb in kbs" :key="kb.id" class="kr">
          <span class="kn">{{ kb.name }}</span>
          <span class="kt" :class="kb.migrationStatus">{{ kb.migrationStatus === 'migrating' ? '迁移中' : kb.migrationStatus === 'ready' ? '就绪' : kb.migrationStatus || 'idle' }}</span>
          <button class="bm" :disabled="migratingKb !== null" @click="startMig(kb.id)">{{ migratingKb === kb.id ? "迁移中..." : "迁移" }}</button>
          <template v-if="migratingKb === kb.id"><div class="pb"><div class="pf" :style="{ width: migPct + '%' }"></div></div><span class="pct">{{ migrated }}/{{ migTotal }}</span></template>
        </div>
        <div v-if="migErr" class="me">{{ migErr }}</div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ai-engine { display: flex; flex-direction: column; gap: 16px; }
.st { text-align: center; padding: 24px; color: var(--color-text-secondary); }
.st.err { color: #ef4444; }
.sec { background: var(--color-bg); border-radius: var(--radius); padding: 16px; }
.sec h4 { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.hint { font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px; }
.sel { padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 4px; font-size: 13px; min-width: 200px; }
.fr { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.fr label { font-size: 13px; color: var(--color-text-secondary); min-width: 80px; }
.inp { padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 4px; font-size: 13px; flex: 1; }
.bar { display: flex; align-items: center; gap: 12px; }
.bs { padding: 8px 20px; background: var(--color-primary); color: #fff; border-radius: 6px; font-size: 13px; }
.bs:disabled { opacity: 0.5; }
.sm { font-size: 13px; color: #16a34a; }
.sm.se { color: #ef4444; }
.kr { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--color-border); }
.kn { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kt { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.kt.ready { background: #dcfce7; color: #166534; }
.kt.migrating { background: #fef3c7; color: #92400e; }
.kt.failed,.kt.idle { background: #f3f4f6; color: #6b7280; }
.bm { padding: 4px 12px; border-radius: 4px; font-size: 12px; background: var(--color-primary); color: #fff; border: none; cursor: pointer; }
.bm:disabled { opacity: 0.5; cursor: not-allowed; }
.pb { width: 100px; height: 6px; background: var(--color-border); border-radius: 3px; overflow: hidden; }
.pf { height: 100%; background: var(--color-primary); border-radius: 3px; transition: width 0.3s; }
.pct { font-size: 11px; color: var(--color-text-secondary); }
.me { color: #ef4444; font-size: 13px; margin-top: 4px; }
</style>
