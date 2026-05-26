import { config } from "../config.js";

export interface TextChunk {
  content: string;
  index: number;
  metadata: Record<string, unknown>;
}

export function splitText(text: string, metadata: Record<string, unknown> = {}): TextChunk[] {
  const { CHUNK_SIZE, CHUNK_OVERLAP } = config;
  const chunks: TextChunk[] = [];

  // 按段落分割
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = "";
  let index = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push({ content: currentChunk.trim(), index, metadata });
      index++;
      // 重叠：保留上一段的最后部分
      const overlap = currentChunk.slice(-CHUNK_OVERLAP);
      currentChunk = overlap + "\n\n" + trimmed;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), index, metadata });
  }

  return chunks;
}
