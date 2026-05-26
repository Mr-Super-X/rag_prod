import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { UserInfo } from "@/types.js";
import { api, setAccessToken } from "@/lib/api.js";

function loadUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<UserInfo | null>(loadUser());
  const isLoggedIn = ref(!!localStorage.getItem("refreshToken"));

  const isAdmin = computed(() => user.value?.role === "admin");

  async function login(username: string, password: string) {
    const res = await api.post<{ accessToken: string; refreshToken: string; token: string; user: UserInfo }>("/auth/login", {
      username,
      password,
    });
    setAccessToken(res.data.accessToken);
    localStorage.setItem("refreshToken", res.data.refreshToken);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    user.value = res.data.user;
    isLoggedIn.value = true;
  }

  async function register(username: string, password: string) {
    await api.post("/auth/register", { username, password });
  }

  function logout() {
    user.value = null;
    isLoggedIn.value = false;
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  return { user, isLoggedIn, isAdmin, login, register, logout };
});
