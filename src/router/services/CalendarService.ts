/**
 * CalendarService - Google Calendar API v3 operations
 * List, create, update, delete events via REST API
 */

import { InterfaceLogger } from '../../interface/types.js';
import { GoogleAuthManager } from './GoogleAuthManager.js';
import {
  CalendarEvent,
  CreateEventOptions,
  UpdateEventOptions,
  CalendarEventListResponse,
} from './google-types.js';

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';
const DEFAULT_CALENDAR = 'primary';
const DEFAULT_TIMEZONE = 'Asia/Seoul';

export class CalendarService {
  private auth: GoogleAuthManager;
  private logger: InterfaceLogger;

  constructor(auth: GoogleAuthManager, logger: InterfaceLogger) {
    this.auth = auth;
    this.logger = logger;
  }

  /** List events in a time range */
  async listEvents(
    timeMin: string,
    timeMax: string,
    maxResults: number = 10,
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: String(maxResults),
      singleEvents: 'true',
      orderBy: 'startTime',
      timeZone: DEFAULT_TIMEZONE,
    });
    const res = await this.auth.fetchApi(
      `${CALENDAR_BASE}/calendars/${DEFAULT_CALENDAR}/events?${params}`,
    );
    if (!res.ok) {
      throw new Error(`일정 조회 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as CalendarEventListResponse;
    return (data.items ?? []).map((item) => this.toCalendarEvent(item));
  }

  /** Create a new event */
  async createEvent(options: CreateEventOptions): Promise<CalendarEvent> {
    const timeZone = options.timeZone ?? DEFAULT_TIMEZONE;
    const body = {
      summary: options.summary,
      description: options.description,
      location: options.location,
      start: { dateTime: options.start, timeZone },
      end: { dateTime: options.end, timeZone },
    };
    const res = await this.auth.fetchApi(
      `${CALENDAR_BASE}/calendars/${DEFAULT_CALENDAR}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      throw new Error(`일정 추가 실패: ${await res.text()}`);
    }
    this.logger('info', `일정 추가 완료: ${options.summary}`);
    const data = (await res.json()) as CalendarEventListResponse['items'][0];
    return this.toCalendarEvent(data);
  }

  /** Update an existing event */
  async updateEvent(eventId: string, updates: UpdateEventOptions): Promise<CalendarEvent> {
    const body = this.buildUpdateBody(updates);
    const res = await this.auth.fetchApi(
      `${CALENDAR_BASE}/calendars/${DEFAULT_CALENDAR}/events/${eventId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      throw new Error(`일정 수정 실패: ${await res.text()}`);
    }
    this.logger('info', `일정 수정 완료: ${eventId}`);
    const data = (await res.json()) as CalendarEventListResponse['items'][0];
    return this.toCalendarEvent(data);
  }

  /** Delete an event */
  async deleteEvent(eventId: string): Promise<void> {
    const res = await this.auth.fetchApi(
      `${CALENDAR_BASE}/calendars/${DEFAULT_CALENDAR}/events/${eventId}`,
      { method: 'DELETE' },
    );
    if (!res.ok && res.status !== 204) {
      throw new Error(`일정 삭제 실패: ${await res.text()}`);
    }
    this.logger('info', `일정 삭제 완료: ${eventId}`);
  }

  /** Convert natural language date to ISO 8601 range */
  static parseDateRange(text: string): { timeMin: string; timeMax: string } | null {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (/오늘/.test(text)) {
      return buildDayRange(today);
    }
    if (/내일/.test(text)) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return buildDayRange(tomorrow);
    }
    if (/이번\s*주/.test(text)) {
      return buildWeekRange(today);
    }
    if (/다음\s*주/.test(text)) {
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return buildWeekRange(nextWeek);
    }
    return null;
  }

  /** Parse natural language time to ISO 8601 */
  static parseDateTime(text: string): string | null {
    const now = new Date();
    const dateMatch = text.match(/(\d{1,2})월\s*(\d{1,2})일/);
    const timeMatch = text.match(/(오전|오후)?\s*(\d{1,2})시\s*(\d{1,2})?분?/);

    if (!timeMatch) return null;

    const date = dateMatch
      ? new Date(now.getFullYear(), Number(dateMatch[1]) - 1, Number(dateMatch[2]))
      : /내일/.test(text)
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let hour = Number(timeMatch[2]);
    const minute = Number(timeMatch[3] ?? 0);
    if (timeMatch[1] === '오후' && hour < 12) hour += 12;
    if (timeMatch[1] === '오전' && hour === 12) hour = 0;

    date.setHours(hour, minute, 0, 0);
    return toKSTISOString(date);
  }

  private buildUpdateBody(updates: UpdateEventOptions): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (updates.summary) body.summary = updates.summary;
    if (updates.description) body.description = updates.description;
    if (updates.location) body.location = updates.location;
    if (updates.start) body.start = { dateTime: updates.start, timeZone: DEFAULT_TIMEZONE };
    if (updates.end) body.end = { dateTime: updates.end, timeZone: DEFAULT_TIMEZONE };
    return body;
  }

  private toCalendarEvent(item: CalendarEventListResponse['items'][0]): CalendarEvent {
    return {
      id: item.id,
      summary: item.summary,
      description: item.description,
      location: item.location,
      start: item.start.dateTime ?? item.start.date ?? '',
      end: item.end.dateTime ?? item.end.date ?? '',
      htmlLink: item.htmlLink,
    };
  }
}

function buildDayRange(date: Date): { timeMin: string; timeMax: string } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { timeMin: toKSTISOString(start), timeMax: toKSTISOString(end) };
}

function buildWeekRange(date: Date): { timeMin: string; timeMax: string } {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { timeMin: toKSTISOString(monday), timeMax: toKSTISOString(sunday) };
}

function toKSTISOString(date: Date): string {
  const offset = 9 * 60;
  const kst = new Date(date.getTime() + (offset + date.getTimezoneOffset()) * 60000);
  return kst.toISOString().replace('Z', '+09:00');
}
