import { db } from "../store/db.js";
import { messages, tags, messageTags, syncState } from "../store/schema.js";
import { eq, and } from "drizzle-orm";
import { getAccount } from "../lib/account.js";

export async function syncCommand(options: { days: string }) {
  const days = parseInt(options.days) || 30;
  const { id: accountId, provider } = await getAccount();

  console.log(`Syncing last ${days} days...`);

  const providerMessages = await provider.getMessages(days);
  console.log(`Fetched ${providerMessages.length} messages from Gmail`);

  for (const msg of providerMessages) {
    const existing = await db
      .select()
      .from(messages)
      .where(and(eq(messages.accountId, accountId), eq(messages.providerMessageId, msg.id)));

    if (existing.length === 0) {
      await db.insert(messages).values({
        accountId,
        providerMessageId: msg.id,
        threadId: msg.threadId,
        subject: msg.subject,
        fromEmail: msg.fromEmail,
        fromName: msg.fromName,
        snippet: msg.snippet,
        receivedAt: msg.receivedAt,
        isRead: msg.isRead,
      });
    }
  }

  await db.update(syncState)
    .set({ lastSyncAt: new Date() })
    .where(eq(syncState.accountId, accountId));

  console.log("Sync complete");
}
