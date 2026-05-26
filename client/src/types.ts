export interface UserInfo {
  id: string;
  username: string;
  role: "admin" | "user";
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  kbId: string;
  filename: string;
  fileType: string;
  fileSize: number | null;
  status: "queued" | "processing" | "ready" | "error";
  chunkCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChunkSource {
  chunkId: string;
  content: string;
  score: number;
  docFilename: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: ChunkSource[] | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  kbId: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}
