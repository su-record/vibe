/**
 * Per-User CalendarService — userId 기반 Google Calendar API 래퍼
 *
 * 일정 CRUD + 자연어 날짜 파싱 + 재시도.
 */

import type { GoogleLogger, GoogleServiceConfig } from '../types.js';
import { createGoogleError, DEFAULT_GOOGLE_CONFIG } from '../types.js';
import { OAuthFlow } from '../OAuthFlow.js';

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';
const DEFAULT_CALENDAR = 'primary';
const DEFAULT_TIMEZONE = 'Asia/Seoul';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  htmlLink?: string;
}

export interface CreateEventInput {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  timeZone?: string;
}

export interface UpdateEventInput {
  summary?: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
}

export class PerUserCalendarService {
  private oauthFlow: OAuthFlow;
  private logger: GoogleLogger;
  private config: Required<GoogleServiceConfig>;

  constructor(oauthFlow: OAuthFlow, logger: GoogleLogger, config?: GoogleServiceConfig) {
    this.oauthFlow = oauthFlow;
    this.logger = logger;
    this.config = {
      apiTimeout: config?.apiTimeout ?? DEFAULT_GOOGLE_CONFIG.apiTimeout,
      maxRetries: config?.maxRetries ?? DEFAULT_GOOGLE_CONFIG.maxRetries,
      refreshMarginMs: config?.refreshMarginMs ?? DEFAULT_GOOGLE_CONFIG.refreshMarginMs,
    };
  }

  /** 일정 조회 */
  async listEvents(
    userId: string,
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
    const res = await this.fetchWithRetry(
      userId,
      `${CALENDAR_BASE}/calendars/${DEFAULT_CALENDAR}/events?${params}`,
    );
    if (!res.ok) {
      throw createGoogleError('API_ERROR', `일정 조회 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as { items?: CalendarEventRaw[] };
    return (data.items ?? []).map(toCalendarEvent);
  }

  /** 일정 생성 */
  async createEvent(userId: string, input: CreateEventInput): Promise<CalendarEvent> {
    const timeZone = input.timeZone ?? DEFAULT_TIMEZONE;
    const body = {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: input.start, timeZone },
      end: { dateTime: input.end, timeZone },
    };
    const res = await this.fetchWithRetry(
      userId,
      `${CALENDAR_BASE}/calendars/${DEFAULT_CALENDAR}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      throw createGoogleError('API_ERROR', `일정 추가 실패: ${await res.text()}`);
    }
    this.logger('info', `Event created: ${input.summary}`);
    const data = (await res.json()) as CalendarEventRaw;
    return toCalendarEvent(data);
  }

  /** 일정 수정 */
  async updateEvent(
    userId: string,
    eventId: string,
    updates: UpdateEventInput,
  ): Promise<CalendarEvent> {
    const body: Record<string, unknown> = {};
    if (updates.summary) body.summary = updates.summary;
    if (updates.description) body.description = updates.description;
    if (updates.location) body.location = updates.location;
    if (updates.start) body.start = { dateTime: updates.start, timeZone: DEFAULT_TIMEZONE };
    if (updates.end) body.end = { dateTime: updates.end, timeZone: DEFAULT_TIMEZONE };

    const res = await this.fetchWithRetry(
      userId,
      `${CALENDAR_BASE}/calendars/${DEFAULT_CALENDAR}/events/${eventId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      throw createGoogleError('API_ERROR', `일정 수정 실패: ${await res.text()}`);
    }
    this.logger('info', `Event updated: ${eventId}`);
    const data = (await res.json()) as CalendarEventRaw;
    return toCalendarEvent(data);
  }

  // ════════════════════════════════════════════════════════════
  // Private
  // ════════════════════════════════════════════════════════════

  private async fetchWithRetry(
    userId: string,
    url: string,
    options?: RequestInit,
  ): Promise<Response> {
    const token = await this.oauthFlow.getValidAccessToken(userId);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...toHeaderRecord(options?.headers),
    };

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.apiTimeout);
        const res = await fetch(url, { ...options, headers, signal: controller.signal });
        clearTimeout(timeout);

        if (res.status !== 429 && res.status < 500) return res;
        const retryAfter = Number(res.headers.get('Retry-After')) || Math.pow(2, attempt);
        await sleep(retryAfter * 1000 + Math.random() * 1000);
      } catch (err) {
        if (attempt === this.config.maxRetries - 1) {
          throw createGoogleError('API_ERROR',
            'Google 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
            { retries: this.config.maxRetries });
        }
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }

    throw createGoogleError('API_ERROR',
      'Google 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
      { retries: this.config.maxRetries });
  }
}

interface CalendarEventRaw {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
}

function toCalendarEvent(item: CalendarEventRaw): CalendarEvent {
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toHeaderRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => { record[key] = value; });
    return record;
  }
  if (Array.isArray(headers)) {
    const record: Record<string, string> = {};
    for (const [key, value] of headers) { record[key] = value; }
    return record;
  }
  return headers as Record<string, string>;
}
