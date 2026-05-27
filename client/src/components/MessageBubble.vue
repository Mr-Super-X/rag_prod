<script setup lang="ts">
import { ref, computed } from "vue";
import type { ChunkSource } from "@/types.js";

const props = defineProps<{
  role: "user" | "assistant";
  content: string;
  sources?: ChunkSource[] | null;
  createdAt: string;
}>();

const expandedIdx = ref<number | null>(null);

function toggleSource(idx: number) {
  expandedIdx.value = expandedIdx.value === idx ? null : idx;
}

interface ContentSegment {
  type: "text" | "citation";
  value: string;
}

const parsedContent = computed(() => parseContent(props.content, props.sources));

function parseContent(raw: string, sources: ChunkSource[] | null | undefined): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const regex = /\[(\d{1,2})\]/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    // 跳过 code block 内的引用
    const before = raw.substring(0, match.index);
    const backtickCount = (before.match(/```/g) || []).length;
    if (backtickCount % 2 === 1) continue;

    if (match.index > lastIdx) {
      segments.push({ type: "text", value: raw.substring(lastIdx, match.index) });
    }
    const n = parseInt(match[1], 10);
    if (sources && n >= 1 && n <= sources.length) {
      segments.push({ type: "citation", value: match[1] });
    } else {
      segments.push({ type: "text", value: match[0] });
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < raw.length) {
    segments.push({ type: "text", value: raw.substring(lastIdx) });
  }
  return segments.length > 0 ? segments : [{ type: "text", value: raw }];
}
</script>

<template>
  <div class="bubble" :class="role">
    <div class="avatar">{{ role === "user" ? "我" : "AI" }}</div>
    <div class="body">
      <div class="content">
        <template v-if="role === 'assistant'">
          <template v-for="(seg, i) in parsedContent" :key="i">
            <span v-if="seg.type === 'text'">{{ seg.value }}</span>
            <span
              v-else
              class="cite-badge"
              :class="{ active: expandedIdx === parseInt(seg.value) - 1 }"
              @click="toggleSource(parseInt(seg.value) - 1)"
            >[{{ seg.value }}]</span>
          </template>
        </template>
        <template v-else>{{ content }}</template>
      </div>

      <!-- 展开的引用原文 -->
      <div
        v-if="sources && expandedIdx !== null && sources[expandedIdx]"
        class="expanded-source"
      >
        <div class="expanded-header">
          <span class="src-label">来源: {{ sources[expandedIdx].docFilename }}</span>
          <span class="src-score">{{ (sources[expandedIdx].score * 100).toFixed(0) }}% 相关</span>
        </div>
        <p class="src-text">{{ sources[expandedIdx].content }}</p>
      </div>

      <!-- 所有来源折叠展示 -->
      <div v-if="sources && sources.length > 0 && role === 'assistant'" class="sources">
        <details>
          <summary>全部来源 ({{ sources.length }})</summary>
          <div v-for="(s, i) in sources" :key="s.chunkId" class="source-item">
            <span class="src-name">[{{ i + 1 }}] {{ s.docFilename }}</span>
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

.cite-badge {
  display: inline; font-size: 12px; font-weight: 600;
  color: var(--color-primary); cursor: pointer;
  padding: 0 1px; border-radius: 3px;
  transition: background 0.15s;
}
.cite-badge:hover, .cite-badge.active {
  background: #e0e7ff;
}

.expanded-source {
  margin-top: 8px; padding: 10px 12px;
  background: var(--color-bg); border-left: 3px solid var(--color-primary);
  border-radius: 0 var(--radius) var(--radius) 0; font-size: 13px;
}
.expanded-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
.src-label { font-weight: 600; color: var(--color-primary); }
.src-score { color: var(--color-text-secondary); font-size: 12px; }
.src-text { color: var(--color-text-secondary); line-height: 1.6; white-space: pre-wrap; }

.sources { margin-top: 6px; }
.sources summary { font-size: 12px; color: var(--color-primary); cursor: pointer; }
.source-item {
  margin-top: 6px; padding: 8px; background: var(--color-bg);
  border-radius: var(--radius); font-size: 12px;
}
.src-name { font-weight: 600; }
</style>
