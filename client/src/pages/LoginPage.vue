<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth.js";

const router = useRouter();
const auth = useAuthStore();

const username = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = "请填写用户名和密码";
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    await auth.login(username.value, password.value);
    router.push("/");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "登录失败";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <form class="auth-card" @submit.prevent="handleLogin">
      <h1>RAG 知识库平台</h1>
      <p class="subtitle">登录你的账号</p>

      <div v-if="error" class="error-msg">{{ error }}</div>

      <label>
        用户名
        <input v-model="username" type="text" autocomplete="username" />
      </label>

      <label>
        密码
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>

      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? "登录中..." : "登录" }}
      </button>

      <p class="switch">
        还没有账号？<router-link to="/register">注册</router-link>
      </p>
    </form>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.auth-card {
  background: var(--color-surface);
  padding: 40px;
  border-radius: 12px;
  box-shadow: var(--shadow);
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
h1 { font-size: 24px; text-align: center; }
.subtitle { text-align: center; color: var(--color-text-secondary); }
label { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
.btn-primary {
  background: var(--color-primary);
  color: #fff;
  padding: 10px;
  font-size: 16px;
}
.btn-primary:disabled { opacity: 0.6; }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
.error-msg {
  background: #fef2f2;
  color: var(--color-danger);
  padding: 8px 12px;
  border-radius: var(--radius);
  font-size: 13px;
}
.switch { text-align: center; font-size: 14px; }
.switch a { color: var(--color-primary); }
</style>
