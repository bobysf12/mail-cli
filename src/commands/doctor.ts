import { existsSync } from "fs";
import { homedir } from "os";
import keytar from "keytar";
import { db } from "../store/db.js";
import { accounts, messages, tags, syncState, calendars, calendarEvents } from "../store/schema.js";
import { getStoredToken } from "../auth/oauth.js";

const SERVICE_NAME = "mail-cli";
const TOKENS_FILE = `${homedir()}/.mail-cli/tokens.json`;
const DB_FILE = process.env.MAIL_DB_PATH || `${homedir()}/.mail-cli/mail.db`;

function check(name: string, fn: () => Promise<boolean | string>): Promise<void> {
  return fn().then((result) => {
    if (result === true) {
      console.log(`  ✓ ${name}`);
    } else if (result === false) {
      console.log(`  ✗ ${name}`);
    } else {
      console.log(`  ✓ ${name}: ${result}`);
    }
  }).catch((err) => {
    console.log(`  ✗ ${name}: ${err.message}`);
  });
}

function checkSync(name: string, fn: () => boolean | string): void {
  try {
    const result = fn();
    if (result === true) {
      console.log(`  ✓ ${name}`);
    } else if (result === false) {
      console.log(`  ✗ ${name}`);
    } else {
      console.log(`  ✓ ${name}: ${result}`);
    }
  } catch (err: any) {
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

export async function doctorCommand() {
  console.log("\nMail CLI Health Check\n");

  console.log("Database:");
  checkSync("DB file exists", () => existsSync(DB_FILE));
  await check("Accounts table", async () => {
    const rows = await db.select().from(accounts);
    return `${rows.length} account(s)`;
  });
  await check("Messages table", async () => {
    const rows = await db.select().from(messages);
    return `${rows.length} message(s)`;
  });
  await check("Tags table", async () => {
    const rows = await db.select().from(tags);
    return `${rows.length} tag(s)`;
  });
  await check("Sync state table", async () => {
    const rows = await db.select().from(syncState);
    return rows.length > 0 ? `last sync: ${rows[0].lastSyncAt?.toLocaleString() || "never"}` : "no sync state";
  });
  await check("Calendars table", async () => {
    const rows = await db.select().from(calendars);
    return `${rows.length} calendar(s)`;
  });
  await check("Calendar events table", async () => {
    const rows = await db.select().from(calendarEvents);
    return `${rows.length} event(s)`;
  });

  console.log("\nEnvironment:");
  checkSync("GMAIL_CLIENT_ID set", () => !!process.env.GMAIL_CLIENT_ID);
  checkSync("GMAIL_CLIENT_SECRET set", () => !!process.env.GMAIL_CLIENT_SECRET);

  console.log("\nTokens:");
  checkSync("Token file exists", () => existsSync(TOKENS_FILE));
  
  let keytarWorks = false;
  try {
    await keytar.findCredentials(SERVICE_NAME);
    keytarWorks = true;
  } catch {}
  checkSync("Keyring available", () => keytarWorks);

  const accountList = await db.select().from(accounts);
  if (accountList.length > 0) {
    console.log("\nPer-account token status:");
    for (const account of accountList) {
      const token = await getStoredToken(account.email);
      if (token) {
        let valid = false;
        let calendarScope = "unknown";
        try {
          const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${token}` },
          });
          valid = res.ok;
          if (valid) {
            const calendarRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1", {
              headers: { Authorization: `Bearer ${token}` },
            });
            calendarScope = calendarRes.ok ? "ok" : "missing/re-auth needed";
          }
        } catch {}
        console.log(`  ${account.email}: ${valid ? "✓ valid" : "✗ invalid/expired"} | calendar: ${calendarScope}`);
      } else {
        console.log(`  ${account.email}: ✗ no token`);
      }
    }
  }

  console.log("\n");
}
