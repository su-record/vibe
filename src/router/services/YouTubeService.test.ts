/**
 * YouTubeService Tests
 * Search, video info, captions, URL extraction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YouTubeService } from './YouTubeService.js';
import { GoogleAuthManager } from './GoogleAuthManager.js';
import { SmartRouterLike } from '../types.js';

const mockLogger = vi.fn();

function createMockAuth(): GoogleAuthManager {
  return {
    fetchApi: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('test-token'),
    isAuthenticated: vi.fn().mockReturnValue(true),
  } as unknown as GoogleAuthManager;
}

describe('YouTubeService', () => {
  let service: YouTubeService;
  let mockAuth: GoogleAuthManager;

  beforeEach(() => {
    mockLogger.mockClear();
    mockAuth = createMockAuth();
    service = new YouTubeService(mockAuth, mockLogger);
  });

  describe('search', () => {
    it('should return video search results', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({
          items: [
            {
              id: { videoId: 'abc123' },
              snippet: {
                title: 'Test Video',
                channelTitle: 'Test Channel',
                publishedAt: '2026-01-01T00:00:00Z',
                thumbnails: { default: { url: 'https://img.youtube.com/vi/abc123/default.jpg' } },
              },
            },
          ],
        }), { status: 200 }),
      );

      const results = await service.search('test query');
      expect(results).toHaveLength(1);
      expect(results[0].videoId).toBe('abc123');
      expect(results[0].title).toBe('Test Video');
    });
  });

  describe('getVideo', () => {
    it('should return detailed video information', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({
          items: [{
            id: 'abc123',
            snippet: {
              title: 'Test Video',
              description: 'A test video',
              channelTitle: 'Test Channel',
              publishedAt: '2026-01-01T00:00:00Z',
              thumbnails: { default: { url: 'https://img.youtube.com/vi/abc123/default.jpg' } },
            },
            contentDetails: { duration: 'PT10M30S' },
            statistics: { viewCount: '1000000', likeCount: '50000' },
          }],
        }), { status: 200 }),
      );

      const video = await service.getVideo('abc123');
      expect(video.title).toBe('Test Video');
      expect(video.viewCount).toBe(1000000);
      expect(video.likeCount).toBe(50000);
      expect(video.duration).toBe('PT10M30S');
    });

    it('should throw when video not found', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      );

      await expect(service.getVideo('nonexistent')).rejects.toThrow('비디오를 찾을 수 없습니다');
    });
  });

  describe('summarize', () => {
    it('should summarize using LLM', async () => {
      const mockRouter: SmartRouterLike = {
        route: vi.fn().mockResolvedValue({
          content: '요약: 이 비디오는 테스트에 대한 내용입니다.',
          success: true,
        }),
      };
      service.setSmartRouter(mockRouter);

      // Mock getCaptions (caption list + download)
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(
          // getCaptions - list
          new Response(JSON.stringify({
            items: [{ id: 'cap-1', snippet: { language: 'ko', trackKind: 'standard', name: '' } }],
          }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          // getCaptions - download
          new Response('1\n00:00:01,000 --> 00:00:05,000\n안녕하세요\n\n', { status: 200 }),
        )
        .mockResolvedValueOnce(
          // getVideo
          new Response(JSON.stringify({
            items: [{
              id: 'abc123',
              snippet: { title: 'Test', description: '', channelTitle: 'CH', publishedAt: '2026-01-01', thumbnails: { default: { url: '' } } },
              contentDetails: { duration: 'PT5M' },
              statistics: { viewCount: '100', likeCount: '10' },
            }],
          }), { status: 200 }),
        );

      const summary = await service.summarize('abc123');
      expect(summary).toContain('요약');
    });

    it('should throw when no SmartRouter configured', async () => {
      await expect(service.summarize('abc123')).rejects.toThrow('LLM이 설정되지 않아');
    });
  });

  describe('extractVideoId', () => {
    it('should extract from standard URL', () => {
      expect(YouTubeService.extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should extract from short URL', () => {
      expect(YouTubeService.extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should extract from embed URL', () => {
      expect(YouTubeService.extractVideoId('https://youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should extract raw video ID', () => {
      expect(YouTubeService.extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid input', () => {
      expect(YouTubeService.extractVideoId('not a video')).toBeNull();
    });

    it('should extract from text with URL', () => {
      expect(
        YouTubeService.extractVideoId('이 유튜브 요약해줘 https://youtube.com/watch?v=abc12345678'),
      ).toBe('abc12345678');
    });
  });
});
