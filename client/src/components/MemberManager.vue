<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "@/lib/api.js";

const props = defineProps<{ kbId: string }>();

interface Member { id: string; userId: string; username: string; role: string; }
const members = ref<Member[]>([]);
const newUser = ref("");
const error = ref("");
const loading = ref(false);

onMounted(() => fetchMembers());

async function fetchMembers() {
  const r = await api.get<Member[]>(`/kb/${props.kbId}/members`);
  members.value = r.data;
}

async function addMember() {
  const u = newUser.value.trim();
  if (!u) return;
  loading.value = true;
  error.value = "";
  try {
    await api.post(`/kb/${props.kbId}/members`, { username: u });
    newUser.value = "";
    await fetchMembers();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "添加失败";
  } finally { loading.value = false; }
}

async function removeMember(userId: string) {
  try {
    await api.delete(`/kb/${props.kbId}/members/${userId}`);
    await fetchMembers();
  } catch { /* ignore */ }
}
</script>

<template>
  <div class="members">
    <h4>知识库成员</h4>

    <div class="add-row">
      <input v-model="newUser" type="text" placeholder="输入用户名添加成员" @keydown.enter="addMember" />
      <button :disabled="loading" @click="addMember">添加</button>
    </div>
    <div v-if="error" class="error">{{ error }}</div>

    <div class="list">
      <div v-for="m in members" :key="m.id" class="row">
        <span class="name">{{ m.username }}</span>
        <span class="role" :class="m.role">{{ m.role === 'owner' ? '拥有者' : '成员' }}</span>
        <button v-if="m.role !== 'owner'" class="btn-remove" @click="removeMember(m.userId)">移除</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.members { display: flex; flex-direction: column; gap: 12px; }
h4 { font-size: 15px; font-weight: 600; }
.add-row { display: flex; gap: 8px; }
.add-row input { flex: 1; }
.add-row button { background: var(--color-primary); color: #fff; font-size: 13px; }
.add-row button:disabled { opacity: 0.5; }
.error { color: var(--color-danger); font-size: 13px; }
.list { display: flex; flex-direction: column; gap: 4px; }
.row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--color-bg); border-radius: var(--radius); font-size: 13px; }
.name { flex: 1; }
.role { font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.role.owner { background: #fef3c7; color: #92400e; }
.role.member { background: #e0e7ff; color: var(--color-primary); }
.btn-remove { background: transparent; color: var(--color-danger); font-size: 12px; padding: 2px 8px; }
.btn-remove:hover { background: #fef2f2; }
</style>
