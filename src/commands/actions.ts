import { db } from "../store/db.js";
import { messages } from "../store/schema.js";
import { eq } from "drizzle-orm";
import { getAccount } from "../lib/account.js";

export async function archiveCommand(id: string) {
  const { provider } = await getAccount();

  const msgResult = await db
    .select()
    .from(messages)
    .where(eq(messages.id, parseInt(id)));

  if (msgResult.length === 0) {
    console.log("Message not found");
    return;
  }

  const msg = msgResult[0];

  await provider.archive(msg.providerMessageId);

  await db
    .update(messages)
    .set({ isArchived: true })
    .where(eq(messages.id, msg.id));

  console.log(`Archived message ${id}`);
}

export async function deleteCommand(id: string) {
  const { provider } = await getAccount();

  const msgResult = await db
    .select()
    .from(messages)
    .where(eq(messages.id, parseInt(id)));

  if (msgResult.length === 0) {
    console.log("Message not found");
    return;
  }

  const msg = msgResult[0];

  await provider.delete(msg.providerMessageId);

  await db
    .update(messages)
    .set({ isDeleted: true })
    .where(eq(messages.id, msg.id));

  console.log(`Deleted message ${id}`);
}
