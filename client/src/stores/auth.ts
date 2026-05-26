import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { UserInfo } from "@/types.js";
import { api } from "@/lib/api.js";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<UserInfo | null>(null);
  const token = ref<string | null>(localStorage.getItem("token"));

  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === "admin");

  async function login(username: string, password: string) {
    const res = await api.post<{ token: string; user: UserInfo }>("/auth/login", {
      username,
      password,
    });
    token.value = res.data.token;
    user.value = res.data.user;
    localStorage.setItem("token", res.data.token);
  }

  async function register(username: string, password: string) {
    await api.post("/auth/register", { username, password });
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem("token");
  }

  return { user, token, isLoggedIn, isAdmin, login, register, logout };
});
