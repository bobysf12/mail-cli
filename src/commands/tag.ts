import { db } from "../store/db.js";
import { messages, tags, messageTags } from "../store/schema.js";
import { eq, and } from "drizzle-orm";
import { getAccount } from "../lib/account.js";

export async function tagListCommand() {
  const { id: accountId } = await getAccount();

  const tagRows = await db
    .select()
    .from(tags)
    .where(eq(tags.accountId, accountId));

  if (tagRows.length === 0) {
    console.log("No tags found");
    return;
  }

  console.log("\nTags:\n");
  for (const tag of tagRows) {
    const count = await db
      .select()
      .from(messageTags)
      .where(eq(messageTags.tagId, tag.id));
    console.log(`  ${tag.name} (${count.length})`);
  }
}

export async function tagAddCommand(id: string, tagName: string) {
  const { id: accountId, provider } = await getAccount();

  const msgResult = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, parseInt(id)), eq(messages.accountId, accountId)));

  if (msgResult.length === 0) {
    console.log("Message not found");
    return;
  }

  const msg = msgResult[0];

  let tagResult = await db
    .select()
    .from(tags)
    .where(and(eq(tags.accountId, accountId), eq(tags.name, tagName)));

  let tagId: number;
  if (tagResult.length === 0) {
    const providerLabelId = await provider.ensureLabelExists(tagName);
    const inserted = await db.insert(tags).values({
      accountId,
      name: tagName,
      providerLabelId,
    }).returning();
    tagId = inserted[0].id;
  } else {
    tagId = tagResult[0].id;
  }

  await provider.addLabel(msg.providerMessageId, tagName);

  const existing = await db
    .select()
    .from(messageTags)
    .where(and(eq(messageTags.messageId, msg.id), eq(messageTags.tagId, tagId)));

  if (existing.length === 0) {
    await db.insert(messageTags).values({
      messageId: msg.id,
      tagId,
    });
  }

  console.log(`Added tag "${tagName}" to message ${id}`);
}

export async function tagRemoveCommand(id: string, tagName: string) {
  const { id: accountId, provider } = await getAccount();

  const msgResult = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, parseInt(id)), eq(messages.accountId, accountId)));

  if (msgResult.length === 0) {
    console.log("Message not found");
    return;
  }

  const msg = msgResult[0];

  const tagResult = await db
    .select()
    .from(tags)
    .where(and(eq(tags.accountId, accountId), eq(tags.name, tagName)));

  if (tagResult.length === 0) {
    console.log(`Tag "${tagName}" not found`);
    return;
  }

  const tagId = tagResult[0].id;

  await provider.removeLabel(msg.providerMessageId, tagName);

  await db
    .delete(messageTags)
    .where(and(eq(messageTags.messageId, msg.id), eq(messageTags.tagId, tagId)));

  console.log(`Removed tag "${tagName}" from message ${id}`);
}
