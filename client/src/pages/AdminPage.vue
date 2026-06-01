<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "@/lib/api.js";
import AppLayout from "@/components/AppLayout.vue";
import AdminTrends from "@/components/AdminTrends.vue";
import AdminErrorDocs from "@/components/AdminErrorDocs.vue";
import AdminAIEngine from "@/components/AdminAIEngine.vue";
import AdminBenchmark from "@/components/AdminBenchmark.vue";
import AdminPerf from "@/components/AdminPerf.vue";

interface User { id: string; username: string; role: string; createdAt: string; }
interface KB { id: string; name: string; createdBy: string; createdAt: string; docCount: number; convCount: number; }
interface Overview { totalUsers: number; totalKBs: number; totalDocs: number; totalConvs: number; todayQuestions: number; }
interface AuditLog { id: string; userId: string; username: string; action: string; resource: string; resourceId: string | null; ip: string | null; createdAt: string; }
interface FeedbackStats { total: number; upCount: number; downCount: number; rate: string; recent: { rating: number; username: string; messageContent: string; createdAt: string }[]; }

const users = ref<User[]>([]);
const kbs = ref<KB[]>([]);
const tab = ref<"users" | "kbs" | "overview" | "audit" | "feedback" | "trends" | "errors" | "ai-engine" | "perf">("overview");

const overview = ref<Overview>({ totalUsers: 0, totalKBs: 0, totalDocs: 0, totalConvs: 0, todayQuestions: 0 });
const auditLogs = ref<AuditLog[]>([]);
const feedbackStats = ref<FeedbackStats>({ total: 0, upCount: 0, downCount: 0, rate: "0", recent: [] });

onMounted(async () => {
  const [u, k, o] = await Promise.all([
    api.get<User[]>("/admin/users"),
    api.get<KB[]>("/admin/kbs"),
    api.get<Overview>("/admin/overview"),
  ]);
  users.value = u.data;
  kbs.value = k.data;
  overview.value = o.data;
});

async function loadAudit() {
  const res = await api.get<AuditLog[]>("/admin/audit-logs");
  auditLogs.value = res.data;
}

async function loadFeedback() {
  const res = await api.get<FeedbackStats>("/admin/feedback-stats");
  feedbackStats.value = res.data;
}

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

function actionLabel(a: string): string {
  const map: Record<string, string> = { login: "登录", create_kb: "创建知识库", delete_kb: "删除知识库", upload_doc: "上传文档", delete_doc: "删除文档" };
  return map[a] || a;
}
</script>

<template>
  <AppLayout>
    <div class="page">
      <h2>管理控制台</h2>
      <div class="tabs">
        <button :class="{ active: tab === 'overview' }" @click="tab = 'overview'">使用概览</button>
        <button :class="{ active: tab === 'users' }" @click="tab = 'users'">用户管理</button>
        <button :class="{ active: tab === 'kbs' }" @click="tab = 'kbs'">知识库管理</button>
        <button :class="{ active: tab === 'audit' }" @click="tab = 'audit'; loadAudit()">审计日志</button>
        <button :class="{ active: tab === 'feedback' }" @click="tab = 'feedback'; loadFeedback()">反馈概览</button>
        <button :class="{ active: tab === 'trends' }" @click="tab = 'trends'">使用趋势</button>
        <button :class="{ active: tab === 'errors' }" @click="tab = 'errors'">失败文档</button>
        <button :class="{ active: tab === 'ai-engine' }" @click="tab = 'ai-engine'">AI 引擎</button>
        <button :class="{ active: tab === 'perf' }" @click="tab = 'perf'">性能</button>
      </div>

      <!-- 使用概览 -->
      <div v-if="tab === 'overview'" class="cards">
        <div class="card"><span class="card-num">{{ overview.totalUsers }}</span><span class="card-label">用户总数</span></div>
        <div class="card"><span class="card-num">{{ overview.totalKBs }}</span><span class="card-label">知识库总数</span></div>
        <div class="card"><span class="card-num">{{ overview.totalDocs }}</span><span class="card-label">文档总数</span></div>
        <div class="card"><span class="card-num">{{ overview.totalConvs }}</span><span class="card-label">对话总数</span></div>
        <div class="card"><span class="card-num">{{ overview.todayQuestions }}</span><span class="card-label">今日提问</span></div>
      </div>

      <!-- 用户管理 -->
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

      <!-- 知识库管理 -->
      <table v-if="tab === 'kbs'">
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

      <!-- 审计日志 -->
      <table v-if="tab === 'audit'">
        <thead><tr><th>时间</th><th>用户</th><th>操作</th><th>资源</th><th>IP</th></tr></thead>
        <tbody>
          <tr v-for="log in auditLogs" :key="log.id">
            <td>{{ new Date(log.createdAt).toLocaleString("zh-CN") }}</td>
            <td>{{ log.username || log.userId.slice(0, 8) }}</td>
            <td>{{ actionLabel(log.action) }}</td>
            <td>{{ log.resource }}{{ log.resourceId ? ' #' + log.resourceId.slice(0, 8) : '' }}</td>
            <td>{{ log.ip || '-' }}</td>
          </tr>
          <tr v-if="auditLogs.length === 0"><td colspan="5" class="empty">暂无审计日志</td></tr>
        </tbody>
      </table>

      <!-- 反馈概览 -->
      <div v-if="tab === 'feedback'">
        <div class="cards">
          <div class="card"><span class="card-num">{{ feedbackStats.total }}</span><span class="card-label">总评分数</span></div>
          <div class="card"><span class="card-num">{{ feedbackStats.upCount }}</span><span class="card-label">好评</span></div>
          <div class="card"><span class="card-num">{{ feedbackStats.downCount }}</span><span class="card-label">差评</span></div>
          <div class="card"><span class="card-num">{{ feedbackStats.rate }}%</span><span class="card-label">好评率</span></div>
        </div>
        <table>
          <thead><tr><th>时间</th><th>用户</th><th>评分</th><th>消息内容</th></tr></thead>
          <tbody>
            <tr v-for="(f, i) in feedbackStats.recent" :key="i">
              <td>{{ new Date(f.createdAt).toLocaleString("zh-CN") }}</td>
              <td>{{ f.username }}</td>
              <td>{{ f.rating === 1 ? '👍' : '👎' }}</td>
              <td class="msg-preview">{{ (f.messageContent || '').slice(0, 80) }}</td>
            </tr>
            <tr v-if="feedbackStats.recent.length === 0"><td colspan="4" class="empty">暂无反馈数据</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 使用趋势 -->
      <AdminTrends v-if="tab === 'trends'" />

      <!-- 失败文档 -->
      <AdminErrorDocs v-if="tab === 'errors'" />

      <!-- AI 引擎 -->
      <div v-if="tab === 'ai-engine'" class="ai-engine-section">
        <AdminAIEngine />
        <AdminBenchmark />
      </div>

      <!-- 性能 -->
      <AdminPerf v-if="tab === 'perf'" />
    </div>
  </AppLayout>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 20px; }
h2 { font-size: 22px; }
.tabs { display: flex; gap: 4px; border-bottom: 2px solid var(--color-border); overflow-x: auto; }
.tabs button { background: transparent; padding: 10px 16px; font-size: 13px; border-radius: 0; border-bottom: 2px solid transparent; margin-bottom: -2px; color: var(--color-text-secondary); white-space: nowrap; }
.tabs button.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
.cards { display: flex; gap: 16px; flex-wrap: wrap; }
.card { background: var(--color-bg); border-radius: var(--radius); padding: 20px; min-width: 140px; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.card-num { font-size: 28px; font-weight: 700; color: var(--color-primary); }
.card-label { font-size: 13px; color: var(--color-text-secondary); }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--color-border); }
th { font-weight: 600; color: var(--color-text-secondary); font-size: 13px; }
.btn-del { background: transparent; color: var(--color-danger); font-size: 13px; padding: 4px 8px; }
.btn-del:hover { background: #fef2f2; }
.empty { text-align: center; color: var(--color-text-secondary); padding: 20px; }
.msg-preview { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text-secondary); font-size: 13px; }
</style>
