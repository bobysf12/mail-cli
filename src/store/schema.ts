import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider", { enum: ["gmail", "outlook"] }).notNull(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  providerMessageId: text("provider_message_id").notNull(),
  threadId: text("thread_id"),
  subject: text("subject"),
  fromEmail: text("from_email"),
  fromName: text("from_name"),
  snippet: text("snippet"),
  receivedAt: integer("received_at", { mode: "timestamp" }),
  isRead: integer("is_read", { mode: "boolean" }).default(false),
  isArchived: integer("is_archived", { mode: "boolean" }).default(false),
  isDeleted: integer("is_deleted", { mode: "boolean" }).default(false),
}, (table) => ({
  accountMessageIdx: uniqueIndex("idx_messages_account_provider").on(table.accountId, table.providerMessageId),
}));

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  name: text("name").notNull(),
  providerLabelId: text("provider_label_id"),
});

export const messageTags = sqliteTable("message_tags", {
  messageId: integer("message_id").notNull().references(() => messages.id),
  tagId: integer("tag_id").notNull().references(() => tags.id),
});

export const syncState = sqliteTable("sync_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
  syncWindowDays: integer("sync_window_days").default(30),
});
