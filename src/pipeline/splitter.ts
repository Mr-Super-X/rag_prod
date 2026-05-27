import { createHash } from "node:crypto";
import { config } from "../config.js";

export interface TextChunk {
  content: string;
  contentHash: string;
  index: number;
  metadata: Record<string, unknown>;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
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
      const content = currentChunk.trim();
      chunks.push({ content, contentHash: sha256(content), index, metadata });
      index++;
      // 重叠：保留上一段的最后部分
      const overlap = currentChunk.slice(-CHUNK_OVERLAP);
      currentChunk = overlap + "\n\n" + trimmed;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
    }
  }

  if (currentChunk.trim()) {
    const content = currentChunk.trim();
    chunks.push({ content, contentHash: sha256(content), index, metadata });
  }

  return chunks;
}
