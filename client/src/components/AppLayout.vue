<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth.js";

const router = useRouter();
const auth = useAuthStore();

function handleLogout() {
  auth.logout();
  router.push("/login");
}
</script>

<template>
  <div class="layout">
    <header class="header">
      <div class="header-left">
        <router-link to="/" class="logo">RAG 知识库</router-link>
      </div>
      <div class="header-right">
        <span class="user-tag" v-if="auth.user">
          {{ auth.user.username }}
          <span class="role-badge" :class="auth.user.role">{{ auth.user.role }}</span>
        </span>
        <button class="btn-logout" @click="handleLogout">退出</button>
      </div>
    </header>
    <main class="main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.layout { min-height: 100vh; display: flex; flex-direction: column; }
.header {
  height: 56px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}
.header-left { display: flex; align-items: center; gap: 16px; }
.logo { font-size: 18px; font-weight: 700; color: var(--color-primary); text-decoration: none; }
.header-right { display: flex; align-items: center; gap: 12px; }
.user-tag { font-size: 14px; display: flex; align-items: center; gap: 6px; }
.role-badge { font-size: 11px; padding: 1px 6px; border-radius: 10px; background: #e0e7ff; color: var(--color-primary); }
.role-badge.admin { background: #fef3c7; color: #92400e; }
.btn-logout { background: transparent; color: var(--color-text-secondary); padding: 6px 12px; font-size: 13px; }
.btn-logout:hover { color: var(--color-danger); }
.main { flex: 1; padding: 24px; max-width: 1200px; width: 100%; margin: 0 auto; }
</style>
