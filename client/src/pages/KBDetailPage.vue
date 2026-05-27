<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import { api } from "@/lib/api.js";
import { useAsync } from "@/composables/useAsync.js";
import AppLayout from "@/components/AppLayout.vue";
import ChatPanel from "@/components/ChatPanel.vue";
import DocUploader from "@/components/DocUploader.vue";
import DocList from "@/components/DocList.vue";
import ConversationList from "@/components/ConversationList.vue";
import MemberManager from "@/components/MemberManager.vue";
import type { KnowledgeBase, Conversation, Message, ApiResponse } from "@/types.js";

const route = useRoute();
const kbId = computed(() => route.params.id as string);

const kb = useAsync<KnowledgeBase>();
const tab = ref<"chat" | "docs" | "members">("chat");

onMounted(() => {
  kb.execute(() => api.get<KnowledgeBase>(`/kb/${kbId.value}`).then((r) => r.data));
});

const refreshKey = ref(0);
const chatKey = ref(0);
const selectedConvId = ref("");
function onUploaded() { refreshKey.value++; }
function onNewChat() {
  chatKey.value++;
}
function onSelectConv(id: string) {
  selectedConvId.value = id;
  chatKey.value++;
  setTimeout(() => { selectedConvId.value = ""; }, 100);
}
</script>

<template>
  <AppLayout>
    <div class="page">
      <!-- Header -->
      <div class="detail-header">
        <button class="btn-back" @click="$router.push('/')">← 返回</button>
        <div v-if="kb.data.value">
          <h2>{{ kb.data.value.name }}</h2>
          <p class="desc" v-if="kb.data.value.description">{{ kb.data.value.description }}</p>
        </div>
        <div v-else-if="kb.loading.value" class="state">加载中...</div>
        <div v-else class="state error">{{ kb.error.value }}</div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button :class="{ active: tab === 'chat' }" @click="tab = 'chat'">问答</button>
        <button :class="{ active: tab === 'docs' }" @click="tab = 'docs'">文档管理</button>
        <button :class="{ active: tab === 'members' }" @click="tab = 'members'">成员</button>
      </div>

      <!-- Tab Content -->
      <div v-if="tab === 'chat'" class="tab-content chat-layout">
        <aside class="chat-sidebar">
          <ConversationList :kb-id="kbId" :key="'conv-' + chatKey" @new-chat="onNewChat" @select="onSelectConv" />
        </aside>
        <div class="chat-main">
          <ChatPanel :kb-id="kbId" :key="chatKey" :load-conv-id="selectedConvId" />
        </div>
      </div>

      <div v-else-if="tab === 'members'" class="tab-content">
        <MemberManager :kb-id="kbId" />
      </div>

      <div v-else class="tab-content">
        <DocUploader :kb-id="kbId" @uploaded="onUploaded" />
        <DocList :kb-id="kbId" :key="refreshKey" />
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 20px; }
.detail-header { display: flex; align-items: flex-start; gap: 16px; }
.btn-back {
  background: transparent; color: var(--color-text-secondary);
  padding: 6px 0; font-size: 14px; margin-top: 2px;
}
.btn-back:hover { color: var(--color-primary); }
h2 { font-size: 20px; }
.desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 4px; }
.state { color: var(--color-text-secondary); font-size: 14px; }
.state.error { color: var(--color-danger); }
.tabs { display: flex; gap: 4px; border-bottom: 2px solid var(--color-border); }
.tabs button {
  background: transparent; padding: 10px 20px; font-size: 14px;
  border-radius: 0; border-bottom: 2px solid transparent; margin-bottom: -2px;
  color: var(--color-text-secondary);
}
.tabs button.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
.tab-content { display: flex; flex-direction: column; gap: 20px; }
.chat-layout { display: flex; flex-direction: row; gap: 20px; }
.chat-main { flex: 1; min-width: 0; }
.chat-sidebar { width: 240px; flex-shrink: 0; max-height: calc(100vh - 200px); overflow-y: auto; }
</style>
