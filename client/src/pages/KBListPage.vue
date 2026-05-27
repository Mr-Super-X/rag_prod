<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/lib/api.js";
import { useAuthStore } from "@/stores/auth.js";
import { useAsync } from "@/composables/useAsync.js";
import AppLayout from "@/components/AppLayout.vue";
import type { KnowledgeBase } from "@/types.js";

const router = useRouter();
const auth = useAuthStore();
const kbs = useAsync<KnowledgeBase[]>();
const create = useAsync<KnowledgeBase>();

const myKBs = computed(() => (kbs.data.value || []).filter((kb) => kb.createdBy === auth.user?.id));
const sharedKBs = computed(() => (kbs.data.value || []).filter((kb) => kb.createdBy !== auth.user?.id));
const hasBoth = computed(() => myKBs.value.length > 0 && sharedKBs.value.length > 0);

const showCreate = ref(false);
const newName = ref("");
const newDesc = ref("");

onMounted(() => {
  kbs.execute(() => api.get<KnowledgeBase[]>("/kb").then((r) => r.data));
});

async function handleCreate() {
  if (!newName.value.trim()) return;
  const kb = await create.execute(() =>
    api.post<KnowledgeBase>("/kb", { name: newName.value, description: newDesc.value }).then((r) => r.data),
  );
  if (kb) {
    showCreate.value = false;
    newName.value = "";
    newDesc.value = "";
    kbs.execute(() => api.get<KnowledgeBase[]>("/kb").then((r) => r.data));
    router.push(`/kb/${kb.id}`);
  }
}

function enterKB(id: string) {
  router.push(`/kb/${id}`);
}
</script>

<template>
  <AppLayout>
    <div class="page">
      <div class="page-header">
        <h2>我的知识库</h2>
        <button class="btn-primary" @click="showCreate = true">+ 新建知识库</button>
      </div>

      <!-- Loading -->
      <div v-if="kbs.loading.value" class="state-msg">加载中...</div>

      <!-- Error -->
      <div v-else-if="kbs.error.value" class="state-msg error">
        {{ kbs.error.value }}
        <button @click="kbs.execute(() => api.get<KnowledgeBase[]>('/kb').then(r => r.data))">重试</button>
      </div>

      <!-- Empty -->
      <div v-else-if="!kbs.data.value || kbs.data.value.length === 0" class="state-msg empty">
        <p>还没有知识库</p>
        <p class="hint">点击上方按钮创建第一个知识库</p>
      </div>

      <!-- List -->
      <div v-else>
        <template v-if="hasBoth">
          <h4 v-if="myKBs.length" class="group-title">我创建的</h4>
          <div class="kb-grid">
            <div v-for="kb in myKBs" :key="kb.id" class="kb-card" @click="enterKB(kb.id)">
              <h3>{{ kb.name }}</h3>
              <p class="desc" v-if="kb.description">{{ kb.description }}</p>
              <p class="meta">{{ new Date(kb.createdAt).toLocaleDateString("zh-CN") }}</p>
            </div>
          </div>
          <h4 v-if="sharedKBs.length" class="group-title">共享给我的</h4>
          <div class="kb-grid">
            <div v-for="kb in sharedKBs" :key="kb.id" class="kb-card shared" @click="enterKB(kb.id)">
              <h3>{{ kb.name }}</h3>
              <p class="meta">{{ new Date(kb.createdAt).toLocaleDateString("zh-CN") }}</p>
            </div>
          </div>
        </template>
        <div v-else class="kb-grid">
          <div v-for="kb in kbs.data.value" :key="kb.id" class="kb-card" @click="enterKB(kb.id)">
            <h3>{{ kb.name }}</h3>
            <p class="desc" v-if="kb.description">{{ kb.description }}</p>
            <p class="meta">{{ new Date(kb.createdAt).toLocaleDateString("zh-CN") }}</p>
          </div>
        </div>
      </div>

      <!-- Create Modal -->
      <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
        <div class="modal">
          <h3>新建知识库</h3>
          <div v-if="create.error.value" class="error-msg">{{ create.error.value }}</div>
          <label>
            名称
            <input v-model="newName" type="text" placeholder="例如：技术文档库" />
          </label>
          <label>
            描述（可选）
            <textarea v-model="newDesc" rows="3" placeholder="简要描述知识库内容" />
          </label>
          <div class="modal-actions">
            <button class="btn-secondary" @click="showCreate = false">取消</button>
            <button class="btn-primary" :disabled="create.loading.value" @click="handleCreate">
              {{ create.loading.value ? "创建中..." : "创建" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 24px; }
.page-header { display: flex; align-items: center; justify-content: space-between; }
h2 { font-size: 22px; }
.btn-primary { background: var(--color-primary); color: #fff; }
.btn-primary:hover { background: var(--color-primary-hover); }
.btn-primary:disabled { opacity: 0.6; }
.btn-secondary { background: var(--color-bg); color: var(--color-text); }
.state-msg { text-align: center; padding: 60px 20px; color: var(--color-text-secondary); }
.state-msg.error { color: var(--color-danger); }
.state-msg.empty .hint { font-size: 13px; margin-top: 8px; }
.kb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.kb-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: box-shadow 0.15s;
}
.group-title { font-size: 14px; font-weight: 600; color: var(--color-text-secondary); margin: 8px 0 4px; }
.kb-card.shared { border-left: 3px solid var(--color-primary); }
.kb-card:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
.kb-card h3 { font-size: 16px; margin-bottom: 8px; }
.desc { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px; }
.meta { font-size: 12px; color: var(--color-text-secondary); }
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: var(--color-surface); border-radius: 12px; padding: 24px;
  width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: 16px;
}
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
.error-msg { background: #fef2f2; color: var(--color-danger); padding: 8px 12px; border-radius: var(--radius); font-size: 13px; }
</style>
