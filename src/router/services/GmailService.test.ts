/**
 * GmailService Tests
 * Send, search, read emails with mocked API responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GmailService } from './GmailService.js';
import { GoogleAuthManager } from './GoogleAuthManager.js';

const mockLogger = vi.fn();

function createMockAuth(): GoogleAuthManager {
  return {
    fetchApi: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('test-token'),
    isAuthenticated: vi.fn().mockReturnValue(true),
  } as unknown as GoogleAuthManager;
}

describe('GmailService', () => {
  let service: GmailService;
  let mockAuth: GoogleAuthManager;

  beforeEach(() => {
    mockLogger.mockClear();
    mockAuth = createMockAuth();
    service = new GmailService(mockAuth, mockLogger);
  });

  describe('sendMail', () => {
    it('should send an email and return message ID', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ id: 'msg-123' }), { status: 200 }),
      );

      const id = await service.sendMail({
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Hello World',
      });

      expect(id).toBe('msg-123');
      expect(mockAuth.fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('/messages/send'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should throw on API error', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response('Forbidden', { status: 403 }),
      );

      await expect(
        service.sendMail({ to: 'x@x.com', subject: 's', body: 'b' }),
      ).rejects.toThrow('메일 전송 실패');
    });

    it('should reject attachments exceeding 25MB', async () => {
      const largeData = Buffer.alloc(26 * 1024 * 1024).toString('base64');

      await expect(
        service.sendMail({
          to: 'x@x.com',
          subject: 's',
          body: 'b',
          attachments: [{ filename: 'big.zip', mimeType: 'application/zip', data: largeData }],
        }),
      ).rejects.toThrow('25MB');
    });
  });

  describe('searchMail', () => {
    it('should return search results', async () => {
      // First call: list messages
      const listResponse = new Response(JSON.stringify({
        messages: [{ id: 'msg-1', threadId: 'thread-1' }],
        resultSizeEstimate: 1,
      }), { status: 200 });

      // Second call: get message metadata
      const metadataResponse = new Response(JSON.stringify({
        id: 'msg-1',
        threadId: 'thread-1',
        snippet: 'Preview text...',
        payload: {
          headers: [
            { name: 'Subject', value: 'Test Mail' },
            { name: 'From', value: 'sender@example.com' },
            { name: 'Date', value: '2026-02-07' },
          ],
        },
      }), { status: 200 });

      (mockAuth.fetchApi as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(listResponse)
        .mockResolvedValueOnce(metadataResponse);

      const result = await service.searchMail('from:sender@example.com');

      expect(result.messages.length).toBe(1);
      expect(result.messages[0].subject).toBe('Test Mail');
      expect(result.messages[0].from).toBe('sender@example.com');
    });

    it('should return empty results when no messages', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ messages: null }), { status: 200 }),
      );

      const result = await service.searchMail('nonexistent');
      expect(result.messages).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getMail', () => {
    it('should return full mail content', async () => {
      const mailResponse = new Response(JSON.stringify({
        id: 'msg-1',
        threadId: 'thread-1',
        snippet: 'Hello...',
        internalDate: '1707300000000',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'me@example.com' },
            { name: 'Subject', value: 'Hello' },
            { name: 'Date', value: '2026-02-07' },
          ],
          mimeType: 'text/plain',
          body: {
            data: Buffer.from('Hello World').toString('base64url'),
            size: 11,
          },
          parts: [],
        },
      }), { status: 200 });

      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(mailResponse);

      const mail = await service.getMail('msg-1');
      expect(mail.from).toBe('sender@example.com');
      expect(mail.subject).toBe('Hello');
      expect(mail.body).toBe('Hello World');
    });
  });
});
