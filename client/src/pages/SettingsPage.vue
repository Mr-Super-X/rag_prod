<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "@/lib/api.js";
import AppLayout from "@/components/AppLayout.vue";

interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

const keys = ref<ApiKey[]>([]);
const newKey = ref("");
const keyName = ref("");
const generating = ref(false);

onMounted(() => fetchKeys());

async function fetchKeys() {
  const res = await api.get<ApiKey[]>("/auth/api-keys");
  keys.value = res.data;
}

async function generate(name: string) {
  generating.value = true;
  try {
    const res = await api.post<{ key: string; id: string }>("/auth/api-keys", { name });
    newKey.value = res.data.key;
    fetchKeys();
  } catch { /* ignore */ }
  generating.value = false;
}

async function revoke(id: string) {
  if (!confirm("确认吊销此 API Key？吊销后无法恢复。")) return;
  await api.delete(`/auth/api-keys/${id}`);
  fetchKeys();
}

function copyKey() {
  navigator.clipboard.writeText(newKey.value);
}
</script>

<template>
  <AppLayout>
    <div class="page">
      <h2>设置</h2>

      <section>
        <h3>API Key</h3>
        <p class="desc">使用 API Key 可以通过 HTTP 接口直接访问知识库问答能力，无需每次登录获取 JWT Token。</p>

        <div v-if="newKey" class="key-reveal">
          <p>新 API Key 已生成（仅显示一次，请立即复制）：</p>
          <code>{{ newKey }}</code>
          <button class="btn-copy" @click="copyKey">复制</button>
        </div>

        <div class="key-form">
          <input v-model="keyName" placeholder="Key 名称（如：自动化脚本）" class="input" />
          <button class="btn-gen" :disabled="generating" @click="generate(keyName || '默认')">
            {{ generating ? "生成中..." : "生成 API Key" }}
          </button>
        </div>

        <table v-if="keys.length > 0">
          <thead><tr><th>名称</th><th>前缀</th><th>最后使用</th><th>创建时间</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="k in keys" :key="k.id">
              <td>{{ k.name }}</td>
              <td><code>{{ k.keyPrefix }}...</code></td>
              <td>{{ k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("zh-CN") : '从未使用' }}</td>
              <td>{{ new Date(k.createdAt).toLocaleDateString("zh-CN") }}</td>
              <td>{{ k.revokedAt ? '已吊销' : '有效' }}</td>
              <td>
                <button v-if="!k.revokedAt" class="btn-revoke" @click="revoke(k.id)">吊销</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">暂无 API Key</p>
      </section>
    </div>
  </AppLayout>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 24px; }
h2 { font-size: 22px; }
h3 { font-size: 16px; margin-bottom: 8px; }
.desc { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 16px; }
.key-reveal { background: #fef3c7; padding: 12px 16px; border-radius: var(--radius); margin-bottom: 12px; font-size: 13px; }
.key-reveal code { display: block; font-size: 14px; padding: 8px; background: #fff; border-radius: 4px; word-break: break-all; margin: 8px 0; }
.btn-copy { font-size: 12px; background: var(--color-primary); color: #fff; padding: 4px 12px; }
.key-form { display: flex; gap: 8px; margin-bottom: 16px; }
.input { flex: 1; }
.btn-gen { background: var(--color-primary); color: #fff; padding: 8px 16px; font-size: 13px; white-space: nowrap; }
.btn-gen:disabled { opacity: 0.5; }
.btn-revoke { background: transparent; color: var(--color-danger); font-size: 12px; padding: 4px 8px; }
.btn-revoke:hover { background: #fef2f2; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--color-border); }
th { font-weight: 600; color: var(--color-text-secondary); }
.empty { color: var(--color-text-secondary); font-size: 13px; padding: 16px 0; }
</style>
