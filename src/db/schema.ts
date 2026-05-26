import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 50 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const knowledgeBases = pgTable(
  "knowledge_bases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kbId: uuid("kb_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    filename: varchar("filename", { length: 500 }).notNull(),
    fileType: varchar("file_type", { length: 20 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }),
    storagePath: varchar("storage_path", { length: 500 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("processing"),
    chunkCount: integer("chunk_count").default(0),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_documents_kb_id").on(t.kbId)],
);

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    docId: uuid("doc_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    kbId: uuid("kb_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    qdrantPointId: varchar("qdrant_point_id", { length: 100 }).notNull(),
    content: text("content").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_chunks_doc_id").on(t.docId),
    index("idx_chunks_kb_id").on(t.kbId),
    index("idx_chunks_qdrant_point_id").on(t.qdrantPointId),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kbId: uuid("kb_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 300 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_conversations_user_id").on(t.userId),
    index("idx_conversations_kb_id").on(t.kbId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    sources: jsonb("sources"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_messages_conversation_id").on(t.conversationId)],
);
