import { db } from "../store/db.js";
import { accounts, syncState } from "../store/schema.js";
import { eq } from "drizzle-orm";
import { authenticate, getStoredToken } from "../auth/oauth.js";
import { GmailProvider } from "../providers/gmail.js";
import type { ProviderAdapter } from "../providers/base.js";

export async function authenticateAccount(): Promise<{ id: number; email: string }> {
  const { email } = await authenticate();
  const existing = await db.select().from(accounts).where(eq(accounts.email, email));

  if (existing.length > 0) {
    return { id: existing[0].id, email };
  }

  const inserted = await db
    .insert(accounts)
    .values({
      provider: "gmail",
      email,
      createdAt: new Date(),
    })
    .returning();

  await db.insert(syncState).values({
    accountId: inserted[0].id,
    syncWindowDays: 30,
  });

  return { id: inserted[0].id, email };
}

export async function getAccount(): Promise<{
  id: number;
  email: string;
  provider: ProviderAdapter;
}> {
  let accountList = await db.select().from(accounts);

  if (accountList.length === 0) {
    console.log("No account found. Starting authentication...");
    await authenticateAccount();
    accountList = await db.select().from(accounts);
  }

  const account = accountList[0];
  const token = await getStoredToken(account.email);
  if (!token) {
    console.log("Token expired or missing. Re-authenticating...");
    await authenticate();
  }

  return {
    id: account.id,
    email: account.email,
    provider: new GmailProvider(account.email),
  };
}

export async function getAccountByEmail(email: string): Promise<{
  id: number;
  provider: ProviderAdapter;
} | null> {
  const accountList = await db.select().from(accounts).where(eq(accounts.email, email));
  if (accountList.length === 0) return null;

  return {
    id: accountList[0].id,
    provider: new GmailProvider(accountList[0].email),
  };
}
