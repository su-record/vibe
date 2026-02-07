/**
 * CalendarService Tests
 * List, create events, date parsing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalendarService } from './CalendarService.js';
import { GoogleAuthManager } from './GoogleAuthManager.js';

const mockLogger = vi.fn();

function createMockAuth(): GoogleAuthManager {
  return {
    fetchApi: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('test-token'),
    isAuthenticated: vi.fn().mockReturnValue(true),
  } as unknown as GoogleAuthManager;
}

describe('CalendarService', () => {
  let service: CalendarService;
  let mockAuth: GoogleAuthManager;

  beforeEach(() => {
    mockLogger.mockClear();
    mockAuth = createMockAuth();
    service = new CalendarService(mockAuth, mockLogger);
  });

  describe('listEvents', () => {
    it('should return formatted events', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({
          items: [
            {
              id: 'evt-1',
              summary: '팀 미팅',
              start: { dateTime: '2026-02-07T15:00:00+09:00' },
              end: { dateTime: '2026-02-07T16:00:00+09:00' },
              htmlLink: 'https://calendar.google.com/event/evt-1',
            },
          ],
        }), { status: 200 }),
      );

      const events = await service.listEvents(
        '2026-02-07T00:00:00+09:00',
        '2026-02-07T23:59:59+09:00',
      );

      expect(events).toHaveLength(1);
      expect(events[0].summary).toBe('팀 미팅');
      expect(events[0].start).toContain('2026-02-07');
    });

    it('should return empty array when no events', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      );

      const events = await service.listEvents(
        '2026-02-07T00:00:00+09:00',
        '2026-02-07T23:59:59+09:00',
      );

      expect(events).toHaveLength(0);
    });
  });

  describe('createEvent', () => {
    it('should create an event and return it', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({
          id: 'evt-new',
          summary: '팀 미팅',
          start: { dateTime: '2026-02-08T15:00:00+09:00' },
          end: { dateTime: '2026-02-08T16:00:00+09:00' },
          htmlLink: 'https://calendar.google.com/event/evt-new',
        }), { status: 200 }),
      );

      const event = await service.createEvent({
        summary: '팀 미팅',
        start: '2026-02-08T15:00:00+09:00',
        end: '2026-02-08T16:00:00+09:00',
      });

      expect(event.id).toBe('evt-new');
      expect(event.summary).toBe('팀 미팅');
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(null, { status: 204 }),
      );

      await expect(service.deleteEvent('evt-1')).resolves.toBeUndefined();
    });
  });

  describe('parseDateRange', () => {
    it('should parse "오늘" to today range', () => {
      const range = CalendarService.parseDateRange('오늘 일정 알려줘');
      expect(range).not.toBeNull();
      expect(range!.timeMin).toBeDefined();
      expect(range!.timeMax).toBeDefined();
    });

    it('should parse "내일" to tomorrow range', () => {
      const range = CalendarService.parseDateRange('내일 일정');
      expect(range).not.toBeNull();
    });

    it('should parse "이번 주" to this week range', () => {
      const range = CalendarService.parseDateRange('이번 주 일정');
      expect(range).not.toBeNull();
    });

    it('should return null for unrecognized date text', () => {
      const range = CalendarService.parseDateRange('some random text');
      expect(range).toBeNull();
    });
  });

  describe('parseDateTime', () => {
    it('should parse "오후 3시" to ISO string', () => {
      const dt = CalendarService.parseDateTime('내일 오후 3시에 미팅');
      expect(dt).not.toBeNull();
      expect(dt).toContain('T');
    });

    it('should parse "오전 10시 30분"', () => {
      const dt = CalendarService.parseDateTime('오전 10시 30분에 회의');
      expect(dt).not.toBeNull();
    });

    it('should return null when no time found', () => {
      const dt = CalendarService.parseDateTime('일정 추가해줘');
      expect(dt).toBeNull();
    });
  });
});
