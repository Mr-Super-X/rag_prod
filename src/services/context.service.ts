import { db, schema } from "../db/index.js";
import { eq, desc } from "drizzle-orm";
import { NotFoundError } from "../lib/errors.js";
import type { ChunkSource } from "../types.js";

const { conversations, messages } = schema;

export async function createConversation(kbId: string, userId: string, title?: string) {
  const [conv] = await db
    .insert(conversations)
    .values({ kbId, userId, title: title || "新对话" })
    .returning();
  return conv;
}

export async function getConversation(id: string, userId: string) {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  if (!conv) throw new NotFoundError("Conversation", id);
  return conv;
}

export async function listConversations(userId: string) {
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

export async function deleteConversation(id: string) {
  await db.delete(conversations).where(eq(conversations.id, id));
}

export async function getMessages(conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

export interface StoredMessage {
  id: string;
  role: string;
  content: string;
  sources: ChunkSource[] | null;
  createdAt: Date;
}

export async function addMessage(
  conversationId: string,
  role: string,
  content: string,
  sources?: ChunkSource[],
): Promise<StoredMessage> {
  const [msg] = await db
    .insert(messages)
    .values({
      conversationId,
      role,
      content,
      sources: sources || null,
    })
    .returning();

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    sources: msg.sources as ChunkSource[] | null,
    createdAt: msg.createdAt,
  };
}

export async function getRecentHistory(conversationId: string, limit = 6): Promise<StoredMessage[]> {
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return msgs.reverse().map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    sources: m.sources as ChunkSource[] | null,
    createdAt: m.createdAt,
  }));
}

export async function updateConversationTitle(conversationId: string, title: string) {
  await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}
