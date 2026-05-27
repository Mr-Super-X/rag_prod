<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "@/lib/api.js";
import AppLayout from "@/components/AppLayout.vue";

interface User { id: string; username: string; role: string; createdAt: string; }
interface KB { id: string; name: string; createdBy: string; createdAt: string; docCount: number; convCount: number; }

const users = ref<User[]>([]);
const kbs = ref<KB[]>([]);
const tab = ref<"users" | "kbs">("users");

onMounted(async () => {
  const [u, k] = await Promise.all([
    api.get<User[]>("/admin/users"),
    api.get<KB[]>("/admin/kbs"),
  ]);
  users.value = u.data;
  kbs.value = k.data;
});

async function deleteUser(id: string, name: string) {
  if (!confirm(`确认删除用户 ${name}？该操作不可撤销。`)) return;
  await api.delete(`/admin/users/${id}`);
  users.value = users.value.filter((u) => u.id !== id);
}
async function deleteKB(id: string, name: string) {
  if (!confirm(`确认删除知识库 ${name}？`)) return;
  await api.delete(`/admin/kbs/${id}`);
  kbs.value = kbs.value.filter((k) => k.id !== id);
}
</script>

<template>
  <AppLayout>
    <div class="page">
      <h2>管理控制台</h2>
      <div class="tabs">
        <button :class="{ active: tab === 'users' }" @click="tab = 'users'">用户管理</button>
        <button :class="{ active: tab === 'kbs' }" @click="tab = 'kbs'">知识库管理</button>
      </div>

      <table v-if="tab === 'users'">
        <thead><tr><th>用户名</th><th>角色</th><th>注册时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.username }}</td>
            <td>{{ u.role === 'admin' ? '管理员' : '用户' }}</td>
            <td>{{ new Date(u.createdAt).toLocaleDateString("zh-CN") }}</td>
            <td><button v-if="u.role !== 'admin'" class="btn-del" @click="deleteUser(u.id, u.username)">删除</button></td>
          </tr>
        </tbody>
      </table>

      <table v-else>
        <thead><tr><th>名称</th><th>文档数</th><th>对话数</th><th>创建时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="k in kbs" :key="k.id">
            <td>{{ k.name }}</td>
            <td>{{ k.docCount }}</td>
            <td>{{ k.convCount }}</td>
            <td>{{ new Date(k.createdAt).toLocaleDateString("zh-CN") }}</td>
            <td><button class="btn-del" @click="deleteKB(k.id, k.name)">强制删除</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppLayout>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 20px; }
h2 { font-size: 22px; }
.tabs { display: flex; gap: 4px; border-bottom: 2px solid var(--color-border); }
.tabs button { background: transparent; padding: 10px 20px; font-size: 14px; border-radius: 0; border-bottom: 2px solid transparent; margin-bottom: -2px; color: var(--color-text-secondary); }
.tabs button.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--color-border); }
th { font-weight: 600; color: var(--color-text-secondary); }
.btn-del { background: transparent; color: var(--color-danger); font-size: 13px; padding: 4px 8px; }
.btn-del:hover { background: #fef2f2; }
</style>
