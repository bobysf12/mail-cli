import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { accounts, messages, tags, messageTags } from "../src/store/schema.js";
import { eq } from "drizzle-orm";

const testDbPath = ":memory:";
const sqlite = new Database(testDbPath);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL CHECK(provider IN ('gmail', 'outlook')),
    email TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  )
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    provider_message_id TEXT NOT NULL,
    thread_id TEXT,
    subject TEXT,
    from_email TEXT,
    from_name TEXT,
    snippet TEXT,
    received_at INTEGER,
    is_read INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0
  )
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    name TEXT NOT NULL,
    provider_label_id TEXT
  )
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS message_tags (
    message_id INTEGER NOT NULL REFERENCES messages(id),
    tag_id INTEGER NOT NULL REFERENCES tags(id),
    PRIMARY KEY (message_id, tag_id)
  )
`);

const db = drizzle(sqlite, { schema: { accounts, messages, tags, messageTags } });

beforeEach(() => {
  sqlite.run(`DELETE FROM message_tags`);
  sqlite.run(`DELETE FROM tags`);
  sqlite.run(`DELETE FROM messages`);
  sqlite.run(`DELETE FROM accounts`);
  
  sqlite.run(`
    INSERT INTO accounts (id, provider, email, created_at)
    VALUES (1, 'gmail', 'test@example.com', ${Date.now()})
  `);
});

describe("database schema", () => {
  test("can insert and query accounts", async () => {
    const result = await db.select().from(accounts);
    expect(result.length).toBe(1);
    expect(result[0].email).toBe("test@example.com");
    expect(result[0].provider).toBe("gmail");
  });

  test("can insert and query messages", async () => {
    await db.insert(messages).values({
      accountId: 1,
      providerMessageId: "msg-123",
      threadId: "thread-456",
      subject: "Test Subject",
      fromEmail: "sender@example.com",
      fromName: "Sender",
      snippet: "This is a test",
      receivedAt: new Date(),
      isRead: false,
    });

    const result = await db.select().from(messages);
    expect(result.length).toBe(1);
    expect(result[0].providerMessageId).toBe("msg-123");
    expect(result[0].subject).toBe("Test Subject");
  });

  test("can insert and query tags", async () => {
    await db.insert(tags).values({
      accountId: 1,
      name: "Important",
      providerLabelId: "label-123",
    });

    const result = await db.select().from(tags);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Important");
  });

  test("can associate tags with messages", async () => {
    await db.insert(messages).values({
      accountId: 1,
      providerMessageId: "msg-123",
      subject: "Test",
    });

    await db.insert(tags).values({
      accountId: 1,
      name: "Important",
    });

    await db.insert(messageTags).values({
      messageId: 1,
      tagId: 1,
    });

    const result = await db.select().from(messageTags);
    expect(result.length).toBe(1);
  });

  test("can upsert messages by provider id", async () => {
    await db.insert(messages).values({
      accountId: 1,
      providerMessageId: "msg-unique",
      subject: "Original",
    });

    const existing = await db
      .select()
      .from(messages)
      .where(eq(messages.providerMessageId, "msg-unique"));

    expect(existing.length).toBe(1);
    expect(existing[0].subject).toBe("Original");
  });
});
