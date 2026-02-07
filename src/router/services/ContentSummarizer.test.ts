/**
 * ContentSummarizer Tests
 * URL summarization, text summarization, tag generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentSummarizer } from './ContentSummarizer.js';
import { SmartRouterLike } from '../types.js';

const mockLogger = vi.fn();

function createMockRouter(content: string = '요약된 내용입니다.'): SmartRouterLike {
  return {
    route: vi.fn().mockResolvedValue({ success: true, content }),
  } as unknown as SmartRouterLike;
}

describe('ContentSummarizer', () => {
  let summarizer: ContentSummarizer;
  let mockRouter: SmartRouterLike;

  beforeEach(() => {
    mockLogger.mockClear();
    mockRouter = createMockRouter();
    summarizer = new ContentSummarizer(mockLogger, mockRouter);
  });

  describe('summarizeText', () => {
    it('should summarize short text in single chunk', async () => {
      const result = await summarizer.summarizeText('짧은 텍스트입니다.');
      expect(result).toBe('요약된 내용입니다.');
      expect(mockRouter.route).toHaveBeenCalledOnce();
    });

    it('should chunk long text and merge summaries', async () => {
      const longText = 'A'.repeat(20_000);
      const result = await summarizer.summarizeText(longText);
      expect(result).toBe('요약된 내용입니다.');
      // Should call route multiple times (chunks + final merge)
      const callCount = (mockRouter.route as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(callCount).toBeGreaterThan(1);
    });

    it('should throw when LLM fails', async () => {
      mockRouter = {
        route: vi.fn().mockResolvedValue({ success: false, content: '' }),
      } as unknown as SmartRouterLike;
      summarizer = new ContentSummarizer(mockLogger, mockRouter);

      await expect(summarizer.summarizeText('test')).rejects.toThrow('요약 생성 실패');
    });
  });

  describe('generateTags', () => {
    it('should parse comma-separated tags from LLM', async () => {
      mockRouter = createMockRouter('기술, AI, 프로그래밍');
      summarizer = new ContentSummarizer(mockLogger, mockRouter);

      const tags = await summarizer.generateTags('AI 관련 기술 문서');
      expect(tags).toContain('기술');
      expect(tags).toContain('AI');
      expect(tags.length).toBeLessThanOrEqual(5);
    });

    it('should return empty array on LLM failure', async () => {
      mockRouter = {
        route: vi.fn().mockResolvedValue({ success: false, content: '' }),
      } as unknown as SmartRouterLike;
      summarizer = new ContentSummarizer(mockLogger, mockRouter);

      const tags = await summarizer.generateTags('test');
      expect(tags).toEqual([]);
    });
  });

  describe('summarizeUrl', () => {
    it('should fetch URL and return summary result', async () => {
      const html = '<html><head><title>Test Page</title></head><body><p>Content here</p></body></html>';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      }));

      const routeFn = vi.fn()
        .mockResolvedValueOnce({ success: true, content: '요약 결과' })
        .mockResolvedValueOnce({ success: true, content: '태그1, 태그2' });
      mockRouter = { route: routeFn } as unknown as SmartRouterLike;
      summarizer = new ContentSummarizer(mockLogger, mockRouter);

      const result = await summarizer.summarizeUrl('https://example.com');
      expect(result.title).toBe('Test Page');
      expect(result.summary).toBe('요약 결과');
      expect(result.tags).toContain('태그1');
      expect(result.url).toBe('https://example.com');

      vi.unstubAllGlobals();
    });
  });
});
