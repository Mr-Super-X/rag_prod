import type { ApiResponse } from "@/types.js";

const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${url}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `HTTP ${res.status}`);
  }

  // 204 No Content 没有响应体
  if (res.status === 204) return { success: true, data: null } as ApiResponse<T>;

  return res.json();
}

export const api = {
  get<T>(url: string) {
    return request<T>(url);
  },
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
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

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
