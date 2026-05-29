export interface UserPayload {
  id: string;
  username: string;
  role: "admin" | "user";
}

export interface ChunkSource {
  chunkId: string;
  content: string;
  score: number;
  vectorScore?: number;
  docFilename: string;
}

export interface ChatRequest {
  question: string;
  conversationId?: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChunkSource[];
  conversationId: string;
}

export interface DocumentUploadResult {
  id: string;
  filename: string;
  status: "queued" | "processing" | "ready" | "error";
  chunkCount: number;
  errorMessage?: string;
}
