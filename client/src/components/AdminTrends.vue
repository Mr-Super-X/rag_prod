<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import * as echarts from "echarts";
import { api } from "@/lib/api.js";

const chartRef = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

interface TrendsData { days: string[]; questions: number[]; activeUsers: number[] }

const data = ref<TrendsData>({ days: [], questions: [], activeUsers: [] });
const loading = ref(true);
const error = ref<string | null>(null);

async function loadTrends(days = 30) {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.get<TrendsData>(`/admin/trends?days=${days}`);
    data.value = res.data;
    loading.value = false;
    await nextTick();
    renderChart();
  } catch {
    loading.value = false;
    error.value = "加载趋势数据失败";
  }
}

function renderChart() {
  if (!chartRef.value) return;
  if (chart) chart.dispose();
  chart = echarts.init(chartRef.value);
  chart.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["提问量", "活跃用户"], top: 0 },
    grid: { left: 50, right: 50, top: 30, bottom: 60 },
    xAxis: { type: "category", data: data.value.days, axisLabel: { rotate: 35, fontSize: 10 } },
    yAxis: [
      { type: "value", name: "提问量", minInterval: 1 },
      { type: "value", name: "活跃用户", minInterval: 1 },
    ],
    series: [
      { name: "提问量", type: "line", data: data.value.questions, smooth: true },
      { name: "活跃用户", type: "line", yAxisIndex: 1, data: data.value.activeUsers, smooth: true },
    ],
  });
}

function handleResize() { chart?.resize(); }

onMounted(() => { loadTrends(); window.addEventListener("resize", handleResize); });
onUnmounted(() => { window.removeEventListener("resize", handleResize); chart?.dispose(); chart = null; });
</script>

<template>
  <div class="admin-trends">
    <div v-if="loading" class="state-msg">加载中...</div>
    <div v-else-if="error" class="state-msg error">{{ error }}</div>
    <div v-else-if="data.days.length === 0" class="state-msg">暂无趋势数据</div>
    <div v-else ref="chartRef" class="chart-container"></div>
  </div>
</template>

<style scoped>
.admin-trends { width: 100%; }
.chart-container { width: 100%; height: 400px; }
.state-msg { text-align: center; padding: 40px; color: var(--color-text-secondary); }
.state-msg.error { color: #ef4444; }
</style>
