import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.js";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { homedir } from "os";

const dbPath = process.env.MAIL_DB_PATH || `${homedir()}/.mail-cli/mail.db`;

function ensureDbDir() {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

ensureDbDir();

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

export type Account = typeof schema.accounts.$inferSelect;
export type NewAccount = typeof schema.accounts.$inferInsert;
export type Message = typeof schema.messages.$inferSelect;
export type NewMessage = typeof schema.messages.$inferInsert;
export type Tag = typeof schema.tags.$inferSelect;
export type NewTag = typeof schema.tags.$inferInsert;
