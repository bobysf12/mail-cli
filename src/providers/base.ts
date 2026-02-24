export interface ProviderAdapter {
  getMessages(days: number): Promise<ProviderMessage[]>;
  getMessage(id: string): Promise<ProviderMessageDetail>;
  addLabel(messageId: string, labelName: string): Promise<void>;
  removeLabel(messageId: string, labelName: string): Promise<void>;
  archive(messageId: string): Promise<void>;
  delete(messageId: string): Promise<void>;
  ensureLabelExists(labelName: string): Promise<string>;
}

export interface ProviderMessage {
  id: string;
  threadId: string;
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  snippet: string | null;
  receivedAt: Date | null;
  isRead: boolean;
  labelIds: string[];
}

export interface ProviderMessageDetail extends ProviderMessage {
  body: string | null;
}

export interface ProviderCalendar {
  id: string;
  summary: string | null;
  timeZone: string | null;
  isPrimary: boolean;
}

export interface ProviderCalendarEvent {
  id: string;
  calendarId: string;
  title: string | null;
  description: string | null;
  location: string | null;
  startAt: Date | null;
  endAt: Date | null;
  isAllDay: boolean;
  status: string | null;
  htmlLink: string | null;
  rrule: string | null;
  recurringEventId: string | null;
  originalStartTime: Date | null;
  updatedAt: Date | null;
}

export interface ListCalendarEventsInput {
  calendarId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface CreateCalendarEventInput {
  calendarId?: string;
  title: string;
  description?: string;
  location?: string;
  startAt: Date;
  endAt: Date;
  isAllDay?: boolean;
  rrule?: string;
}

export interface UpdateCalendarEventInput {
  calendarId?: string;
  title?: string;
  description?: string;
  location?: string;
  startAt?: Date;
  endAt?: Date;
  isAllDay?: boolean;
  rrule?: string;
  clearRrule?: boolean;
}

export interface CalendarProviderAdapter {
  listCalendars(): Promise<ProviderCalendar[]>;
  listEvents(input: ListCalendarEventsInput): Promise<ProviderCalendarEvent[]>;
  getEvent(eventId: string, calendarId?: string): Promise<ProviderCalendarEvent>;
  createEvent(input: CreateCalendarEventInput): Promise<ProviderCalendarEvent>;
  updateEvent(eventId: string, input: UpdateCalendarEventInput): Promise<ProviderCalendarEvent>;
  deleteEvent(eventId: string, calendarId?: string): Promise<void>;
}
