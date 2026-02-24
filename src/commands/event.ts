import { and, eq } from "drizzle-orm";
import { db } from "../store/db.js";
import { calendarEvents } from "../store/schema.js";
import { getAccount } from "../lib/account.js";
import { GoogleCalendarProvider } from "../providers/google-calendar.js";
import { normalizeAndValidateRRule } from "../lib/rrule.js";
import type { ProviderCalendarEvent } from "../providers/base.js";

function parseIsoDate(value: string | undefined, fieldName: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}: expected ISO-8601 date/time`);
  }
  return date;
}

function formatEventLine(localId: number, event: ProviderCalendarEvent): string {
  const when = event.startAt ? event.startAt.toISOString() : "N/A";
  const title = event.title || "(no title)";
  const recur = event.rrule ? " [R]" : "";
  return `[${localId}] ${when}${recur} | ${title}`;
}

async function upsertCalendarEvent(accountId: number, event: ProviderCalendarEvent): Promise<number> {
  const existing = await db
    .select()
    .from(calendarEvents)
    .where(and(
      eq(calendarEvents.accountId, accountId),
      eq(calendarEvents.providerEventId, event.id)
    ));

  const payload = {
    accountId,
    providerCalendarId: event.calendarId,
    providerEventId: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startAt: event.startAt,
    endAt: event.endAt,
    isAllDay: event.isAllDay,
    status: event.status,
    htmlLink: event.htmlLink,
    rrule: event.rrule,
    recurringEventId: event.recurringEventId,
    originalStartTime: event.originalStartTime,
    updatedAt: event.updatedAt,
  };

  if (existing.length > 0) {
    await db
      .update(calendarEvents)
      .set(payload)
      .where(eq(calendarEvents.id, existing[0].id));
    return existing[0].id;
  }

  const inserted = await db.insert(calendarEvents).values(payload).returning();
  return inserted[0].id;
}

export async function eventListCommand(options: { from?: string; to?: string; limit: string; calendar?: string }) {
  const limit = parseInt(options.limit) || 20;
  const from = parseIsoDate(options.from, "from");
  const to = parseIsoDate(options.to, "to");

  const { id: accountId, email } = await getAccount();
  const provider = new GoogleCalendarProvider(email);
  const events = await provider.listEvents({
    from,
    to,
    limit,
    calendarId: options.calendar,
  });

  if (events.length === 0) {
    console.log("No events found");
    return;
  }

  console.log("\nEvents:\n");
  for (const event of events) {
    const localId = await upsertCalendarEvent(accountId, event);
    console.log(formatEventLine(localId, event));
  }
}

export async function eventShowCommand(id: string) {
  const localId = parseInt(id);
  if (Number.isNaN(localId)) {
    console.log("Invalid event ID");
    return;
  }

  const { id: accountId, email } = await getAccount();
  const provider = new GoogleCalendarProvider(email);

  const result = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, localId), eq(calendarEvents.accountId, accountId)));

  if (result.length === 0) {
    console.log("Event not found. Run `bun run calendar ls` to sync local IDs.");
    return;
  }

  const local = result[0];
  const detail = await provider.getEvent(local.providerEventId, local.providerCalendarId);
  await upsertCalendarEvent(accountId, detail);

  console.log("\n" + "=".repeat(60));
  console.log(`Title: ${detail.title || "(no title)"}`);
  console.log(`When: ${detail.startAt?.toISOString() || "N/A"} - ${detail.endAt?.toISOString() || "N/A"}`);
  console.log(`Location: ${detail.location || "N/A"}`);
  console.log(`Status: ${detail.status || "N/A"}`);
  if (detail.rrule) console.log(`RRULE: ${detail.rrule}`);
  if (detail.description) {
    console.log("\n" + detail.description);
  }
  console.log("=".repeat(60) + "\n");
}

export async function eventAddCommand(options: {
  title: string;
  start: string;
  end: string;
  calendar?: string;
  location?: string;
  description?: string;
  allDay?: boolean;
  rrule?: string;
}) {
  const startAt = parseIsoDate(options.start, "start");
  const endAt = parseIsoDate(options.end, "end");
  if (!startAt || !endAt) {
    throw new Error("--start and --end are required");
  }
  if (endAt <= startAt) {
    throw new Error("--end must be after --start");
  }

  const rrule = options.rrule ? normalizeAndValidateRRule(options.rrule) : undefined;

  const { id: accountId, email } = await getAccount();
  const provider = new GoogleCalendarProvider(email);
  const created = await provider.createEvent({
    calendarId: options.calendar,
    title: options.title,
    startAt,
    endAt,
    description: options.description,
    location: options.location,
    isAllDay: !!options.allDay,
    ...(rrule ? { rrule } : {}),
  });

  const localId = await upsertCalendarEvent(accountId, created);
  console.log(`Created event ${localId}`);
}

export async function eventUpdateCommand(
  id: string,
  options: {
    title?: string;
    start?: string;
    end?: string;
    calendar?: string;
    location?: string;
    description?: string;
    allDay?: boolean;
    rrule?: string;
    clearRrule?: boolean;
  }
) {
  const localId = parseInt(id);
  if (Number.isNaN(localId)) {
    console.log("Invalid event ID");
    return;
  }
  if (options.clearRrule && options.rrule) {
    throw new Error("Use either --rrule or --clear-rrule, not both");
  }

  const { id: accountId, email } = await getAccount();
  const provider = new GoogleCalendarProvider(email);
  const result = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, localId), eq(calendarEvents.accountId, accountId)));

  if (result.length === 0) {
    console.log("Event not found. Run `bun run calendar ls` to sync local IDs.");
    return;
  }

  const local = result[0];
  const startAt = parseIsoDate(options.start, "start");
  const endAt = parseIsoDate(options.end, "end");

  const updated = await provider.updateEvent(local.providerEventId, {
    calendarId: options.calendar || local.providerCalendarId,
    title: options.title,
    description: options.description,
    location: options.location,
    startAt,
    endAt,
    isAllDay: options.allDay,
    ...(options.rrule ? { rrule: normalizeAndValidateRRule(options.rrule) } : {}),
    clearRrule: options.clearRrule,
  });

  await upsertCalendarEvent(accountId, updated);
  console.log(`Updated event ${localId}`);
}

export async function eventRemoveCommand(id: string) {
  const localId = parseInt(id);
  if (Number.isNaN(localId)) {
    console.log("Invalid event ID");
    return;
  }

  const { id: accountId, email } = await getAccount();
  const provider = new GoogleCalendarProvider(email);
  const result = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, localId), eq(calendarEvents.accountId, accountId)));

  if (result.length === 0) {
    console.log("Event not found");
    return;
  }

  const event = result[0];
  await provider.deleteEvent(event.providerEventId, event.providerCalendarId);
  await db
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.id, localId), eq(calendarEvents.accountId, accountId)));

  console.log(`Deleted event ${localId}`);
}
