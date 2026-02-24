import { db } from "../store/db.js";
import { messages, tags, messageTags } from "../store/schema.js";
import { eq, desc, and, inArray } from "drizzle-orm";
import { getAccount } from "../lib/account.js";

export async function listCommand(options: { tag?: string; limit: string; includeArchived?: boolean; includeDeleted?: boolean }) {
  const limit = parseInt(options.limit) || 20;
  const { id: accountId, provider } = await getAccount();

  const conditions = [eq(messages.accountId, accountId)];
  if (!options.includeArchived) {
    conditions.push(eq(messages.isArchived, false));
  }
  if (!options.includeDeleted) {
    conditions.push(eq(messages.isDeleted, false));
  }

  let result = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.receivedAt))
    .limit(limit);

  if (options.tag) {
    const tagRows = await db
      .select()
      .from(tags)
      .where(and(eq(tags.accountId, accountId), eq(tags.name, options.tag)));

    if (tagRows.length > 0) {
      const tagId = tagRows[0].id;
      const msgTagRows = await db
        .select()
        .from(messageTags)
        .where(eq(messageTags.tagId, tagId));

      const msgIds = msgTagRows.map((mt) => mt.messageId);
      result = result.filter((m) => msgIds.includes(m.id));
    }
  }

  if (result.length === 0) {
    console.log("No messages found");
    return;
  }

  console.log("\nMessages:\n");
  for (const msg of result) {
    const date = msg.receivedAt?.toLocaleDateString() || "N/A";
    const from = msg.fromName || msg.fromEmail || "Unknown";
    const subj = msg.subject || "(no subject)";
    const readMark = msg.isRead ? " " : "*";
    console.log(`${readMark} [${msg.id}] ${date} | ${from}: ${subj}`);
  }
}

export async function showCommand(id: string) {
  const { id: accountId, provider } = await getAccount();

  const result = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, parseInt(id)), eq(messages.accountId, accountId)));

  if (result.length === 0) {
    console.log("Message not found");
    return;
  }

  const msg = result[0];
  const detail = await provider.getMessage(msg.providerMessageId);

  console.log("\n" + "=".repeat(60));
  console.log(`Subject: ${detail.subject || "(no subject)"}`);
  console.log(`From: ${detail.fromName ? `${detail.fromName} <${detail.fromEmail}>` : detail.fromEmail}`);
  console.log(`Date: ${detail.receivedAt?.toLocaleString() || "N/A"}`);
  console.log("=".repeat(60));
  
  if (detail.body) {
    console.log("\n" + detail.body.slice(0, 2000) + (detail.body.length > 2000 ? "..." : ""));
  } else if (detail.snippet) {
    console.log("\n" + detail.snippet);
  }
  console.log();
}
