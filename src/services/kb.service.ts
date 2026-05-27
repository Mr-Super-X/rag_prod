import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { NotFoundError, ForbiddenError } from "../lib/errors.js";
import { dropTable } from "../lib/vectordb.js";

const { knowledgeBases, kbMembers } = schema;

export interface CreateKBInput {
  name: string;
  description?: string;
}

export async function listKBs(userId: string) {
  return db.select().from(knowledgeBases).where(eq(knowledgeBases.createdBy, userId));
}

export async function createKB(input: CreateKBInput, userId: string) {
  const [kb] = await db
    .insert(knowledgeBases)
    .values({ ...input, createdBy: userId })
    .returning();
  // 创建者自动成为 owner 成员
  await db.insert(kbMembers).values({ kbId: kb.id, userId, role: "owner" });
  return kb;
}

export async function getKB(id: string) {
  const [kb] = await db.select().from(knowledgeBases).where(eq(knowledgeBases.id, id)).limit(1);
  if (!kb) throw new NotFoundError("KnowledgeBase", id);
  return kb;
}

export async function updateKB(id: string, input: Partial<CreateKBInput>, userId: string) {
  const kb = await getKB(id);
  if (kb.createdBy !== userId) throw new ForbiddenError();

  const [updated] = await db
    .update(knowledgeBases)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(knowledgeBases.id, id))
    .returning();
  return updated;
}

export async function deleteKB(id: string, userId: string, userRole: string) {
  const kb = await getKB(id);
  if (kb.createdBy !== userId && userRole !== "admin") throw new ForbiddenError();

  await dropTable(id);
  await db.delete(knowledgeBases).where(eq(knowledgeBases.id, id));
}
