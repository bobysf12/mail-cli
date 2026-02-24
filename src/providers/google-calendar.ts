import { getStoredToken } from "../auth/oauth.js";
import type {
  CalendarProviderAdapter,
  CreateCalendarEventInput,
  ListCalendarEventsInput,
  ProviderCalendar,
  ProviderCalendarEvent,
  UpdateCalendarEventInput,
} from "./base.js";
import { toGoogleRecurrence } from "../lib/rrule.js";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const DEFAULT_CALENDAR = "primary";

type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: { date?: string; dateTime?: string };
  updated?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

export class GoogleCalendarProvider implements CalendarProviderAdapter {
  private email: string;

  constructor(email: string) {
    this.email = email;
  }

  private async request<T>(path: string, method = "GET", body?: object): Promise<T> {
    const token = await getStoredToken(this.email);
    if (!token) throw new Error(`Not authenticated for ${this.email}`);

    const response = await fetch(`${CALENDAR_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Calendar API error: ${response.status} ${text}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  private parseGoogleDate(value: { date?: string; dateTime?: string } | undefined): Date | null {
    if (!value) return null;
    if (value.dateTime) return new Date(value.dateTime);
    if (value.date) return new Date(`${value.date}T00:00:00.000Z`);
    return null;
  }

  private toDateOnlyString(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private mapEvent(calendarId: string, event: GoogleEvent): ProviderCalendarEvent {
    const rrule = event.recurrence?.find((line) => line.toUpperCase().startsWith("RRULE:")) ?? null;
    return {
      id: event.id,
      calendarId,
      title: event.summary ?? null,
      description: event.description ?? null,
      location: event.location ?? null,
      startAt: this.parseGoogleDate(event.start),
      endAt: this.parseGoogleDate(event.end),
      isAllDay: !!event.start?.date,
      status: event.status ?? null,
      htmlLink: event.htmlLink ?? null,
      rrule: rrule ? rrule.replace(/^RRULE:/i, "") : null,
      recurringEventId: event.recurringEventId ?? null,
      originalStartTime: this.parseGoogleDate(event.originalStartTime),
      updatedAt: event.updated ? new Date(event.updated) : null,
    };
  }

  async listCalendars(): Promise<ProviderCalendar[]> {
    const data = await this.request<{ items?: Array<{ id: string; summary?: string; timeZone?: string; primary?: boolean }> }>(
      "/users/me/calendarList"
    );

    return (data.items ?? []).map((calendar) => ({
      id: calendar.id,
      summary: calendar.summary ?? null,
      timeZone: calendar.timeZone ?? null,
      isPrimary: !!calendar.primary,
    }));
  }

  async listEvents(input: ListCalendarEventsInput): Promise<ProviderCalendarEvent[]> {
    const calendarId = input.calendarId ?? DEFAULT_CALENDAR;
    const params = new URLSearchParams();
    params.set("maxResults", String(input.limit ?? 50));
    params.set("singleEvents", "false");
    if (input.from) params.set("timeMin", input.from.toISOString());
    if (input.to) params.set("timeMax", input.to.toISOString());

    const data = await this.request<{ items?: GoogleEvent[] }>(
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`
    );

    return (data.items ?? []).map((event) => this.mapEvent(calendarId, event));
  }

  async getEvent(eventId: string, calendarId = DEFAULT_CALENDAR): Promise<ProviderCalendarEvent> {
    const data = await this.request<GoogleEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    );
    return this.mapEvent(calendarId, data);
  }

  async createEvent(input: CreateCalendarEventInput): Promise<ProviderCalendarEvent> {
    const calendarId = input.calendarId ?? DEFAULT_CALENDAR;
    const isAllDay = !!input.isAllDay;
    const payload: Record<string, unknown> = {
      summary: input.title,
      ...(input.description ? { description: input.description } : {}),
      ...(input.location ? { location: input.location } : {}),
      ...(isAllDay
        ? {
            start: { date: this.toDateOnlyString(input.startAt) },
            end: { date: this.toDateOnlyString(input.endAt) },
          }
        : {
            start: { dateTime: input.startAt.toISOString() },
            end: { dateTime: input.endAt.toISOString() },
          }),
      ...(input.rrule ? { recurrence: toGoogleRecurrence(input.rrule) } : {}),
    };

    const data = await this.request<GoogleEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      "POST",
      payload
    );
    return this.mapEvent(calendarId, data);
  }

  async updateEvent(eventId: string, input: UpdateCalendarEventInput): Promise<ProviderCalendarEvent> {
    const calendarId = input.calendarId ?? DEFAULT_CALENDAR;
    const payload: Record<string, unknown> = {};

    if (input.title !== undefined) payload.summary = input.title;
    if (input.description !== undefined) payload.description = input.description;
    if (input.location !== undefined) payload.location = input.location;

    if (input.startAt || input.endAt) {
      const isAllDay = !!input.isAllDay;
      if (isAllDay) {
        if (input.startAt) payload.start = { date: this.toDateOnlyString(input.startAt) };
        if (input.endAt) payload.end = { date: this.toDateOnlyString(input.endAt) };
      } else {
        if (input.startAt) payload.start = { dateTime: input.startAt.toISOString() };
        if (input.endAt) payload.end = { dateTime: input.endAt.toISOString() };
      }
    }

    if (input.clearRrule) {
      payload.recurrence = [];
    } else if (input.rrule) {
      payload.recurrence = toGoogleRecurrence(input.rrule);
    }

    const data = await this.request<GoogleEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      "PATCH",
      payload
    );
    return this.mapEvent(calendarId, data);
  }

  async deleteEvent(eventId: string, calendarId = DEFAULT_CALENDAR): Promise<void> {
    await this.request<void>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      "DELETE"
    );
  }
}
