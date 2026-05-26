<script setup lang="ts">
import type { ChunkSource } from "@/types.js";

defineProps<{
  role: "user" | "assistant";
  content: string;
  sources?: ChunkSource[] | null;
  createdAt: string;
}>();
</script>

<template>
  <div class="bubble" :class="role">
    <div class="avatar">{{ role === "user" ? "我" : "AI" }}</div>
    <div class="body">
      <div class="content" v-text="content" />
      <div v-if="sources && sources.length > 0" class="sources">
        <details>
          <summary>引用来源 ({{ sources.length }})</summary>
          <div v-for="(s, i) in sources" :key="s.chunkId" class="source-item">
            <span class="src-name">{{ s.docFilename }}</span>
            <span class="src-score">{{ (s.score * 100).toFixed(0) }}%</span>
            <p class="src-text">{{ s.content.slice(0, 200) }}</p>
          </div>
        </details>
      </div>
      <div class="time">{{ new Date(createdAt).toLocaleTimeString("zh-CN") }}</div>
    </div>
  </div>
</template>

<style scoped>
.bubble { display: flex; gap: 10px; margin-bottom: 16px; }
.bubble.user { flex-direction: row-reverse; }
.avatar {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; flex-shrink: 0;
}
.bubble.user .avatar { background: var(--color-primary); color: #fff; }
.bubble.assistant .avatar { background: #e0e7ff; color: var(--color-primary); }
.body { max-width: 80%; }
.bubble.user .body { text-align: right; }
.content { font-size: 14px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.bubble.user .content {
  background: var(--color-primary); color: #fff;
  padding: 10px 14px; border-radius: 12px 12px 2px 12px;
  display: inline-block; text-align: left;
}
.time { font-size: 11px; color: var(--color-text-secondary); margin-top: 4px; }
.sources { margin-top: 6px; }
.sources summary { font-size: 12px; color: var(--color-primary); cursor: pointer; }
.source-item {
  margin-top: 6px; padding: 8px; background: var(--color-bg);
  border-radius: var(--radius); font-size: 12px;
}
.src-name { font-weight: 600; }
.src-score { margin-left: 8px; color: var(--color-text-secondary); }
.src-text { color: var(--color-text-secondary); margin-top: 4px; font-size: 12px; }
</style>
