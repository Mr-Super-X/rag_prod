import type { ApiResponse } from "@/types.js";

const BASE = "/api";

// accessToken 存在内存中（页面刷新清空），refreshToken 存在 localStorage
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

function getRefreshToken(): string | null {
  return localStorage.getItem("refreshToken");
}

function setRefreshToken(token: string) {
  localStorage.setItem("refreshToken", token);
}

export function setAccessToken(token: string) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function clearAuth() {
  accessToken = null;
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("token"); // 清理 V1 旧字段
}

async function refreshAccessToken(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;

  // 防止并发请求同时 refresh
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) throw new Error("refresh failed");
      const data = await res.json();
      accessToken = data.data.accessToken;
      setRefreshToken(data.data.refreshToken);
      return accessToken;
    } catch {
      clearAuth();
      window.location.href = "/login";
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let res = await fetch(`${BASE}${url}`, { ...options, headers });

  // 401 → 尝试 refresh token
  if (res.status === 401 && getRefreshToken()) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${BASE}${url}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return { success: true, data: null } as ApiResponse<T>;
  return res.json();
}

export const api = {
  get<T>(url: string) { return request<T>(url); },
  post<T>(url: string, body?: unknown) {
    return request<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  patch<T>(url: string, body: unknown) {
    return request<T>(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  delete(url: string) {
    return request<null>(url, { method: "DELETE" });
  },
  upload<T>(url: string, formData: FormData) {
    const headers: Record<string, string> = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    return fetch(`${BASE}${url}`, {
      method: "POST",
      headers,
      body: formData,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
      return data as ApiResponse<T>;
    });
  },
};

// SSE 流式请求
export function streamChat(
  kbId: string,
  question: string,
  conversationId: string | undefined,
  onToken: (token: string) => void,
  onDone: (result: { conversationId: string; sources: unknown[]; answer?: string; fallback?: boolean; agent?: boolean }) => void,
  onError: (err: Error) => void,
): AbortController {
  const controller = new AbortController();

  fetch(`${BASE}/kb/${kbId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ question, conversationId }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              onToken(data.token);
            } else if (data.done) {
              onDone(data);
            } else if (data.error) {
              onError(new Error(data.error));
            }
          } catch { /* skip */ }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err);
    });

  return controller;
}
