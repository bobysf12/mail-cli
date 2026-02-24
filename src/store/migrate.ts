import { Database } from "bun:sqlite";
import { homedir } from "os";
import { dirname } from "path";
import { existsSync, mkdirSync } from "fs";

const dbPath = process.env.MAIL_DB_PATH || `${homedir()}/.mail-cli/mail.db`;

const dir = dirname(dbPath);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);

db.run(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL CHECK(provider IN ('gmail', 'outlook')),
    email TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  )
`);

db.run(`
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

db.run(`
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    name TEXT NOT NULL,
    provider_label_id TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS message_tags (
    message_id INTEGER NOT NULL REFERENCES messages(id),
    tag_id INTEGER NOT NULL REFERENCES tags(id),
    PRIMARY KEY (message_id, tag_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    last_sync_at INTEGER,
    sync_window_days INTEGER DEFAULT 30
  )
`);

db.run(`CREATE INDEX IF NOT EXISTS idx_messages_account ON messages(account_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_messages_provider_id ON messages(provider_message_id)`);
db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_account_provider ON messages(account_id, provider_message_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_tags_account ON tags(account_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_message_tags_message ON message_tags(message_id)`);

db.close();

console.log("Database migrated successfully");
