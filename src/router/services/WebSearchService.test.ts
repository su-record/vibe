/**
 * WebSearchService Tests
 * LLM-based web search + result parsing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSearchService } from './WebSearchService.js';
import { SmartRouterLike } from '../types.js';

const mockLogger = vi.fn();

function createMockRouter(response?: { success: boolean; content: string }): SmartRouterLike {
  return {
    route: vi.fn().mockResolvedValue(response ?? { success: true, content: '[]' }),
  } as unknown as SmartRouterLike;
}

describe('WebSearchService', () => {
  let service: WebSearchService;
  let mockRouter: SmartRouterLike;

  beforeEach(() => {
    mockLogger.mockClear();
    mockRouter = createMockRouter();
    service = new WebSearchService(mockLogger, mockRouter);
  });

  describe('search', () => {
    it('should return parsed search results from LLM JSON', async () => {
      const jsonResults = JSON.stringify([
        { title: 'Result 1', url: 'https://example.com/1', snippet: 'First result' },
        { title: 'Result 2', url: 'https://example.com/2', snippet: 'Second result' },
      ]);
      mockRouter = createMockRouter({ success: true, content: jsonResults });
      service = new WebSearchService(mockLogger, mockRouter);

      const results = await service.search('test query');
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Result 1');
      expect(results[0].url).toBe('https://example.com/1');
      expect(results[1].snippet).toBe('Second result');
    });

    it('should fallback parse URLs when JSON parsing fails', async () => {
      const unstructured = 'Check https://example.com/a and https://example.com/b for details';
      mockRouter = createMockRouter({ success: true, content: unstructured });
      service = new WebSearchService(mockLogger, mockRouter);

      const results = await service.search('test', 5);
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].url).toBe('https://example.com/a');
    });

    it('should return empty array when LLM fails', async () => {
      mockRouter = createMockRouter({ success: false, content: '' });
      service = new WebSearchService(mockLogger, mockRouter);

      const results = await service.search('fail query');
      expect(results).toEqual([]);
    });

    it('should respect maxResults limit', async () => {
      const many = Array.from({ length: 10 }, (_, i) => ({
        title: `R${i}`, url: `https://example.com/${i}`, snippet: `S${i}`,
      }));
      mockRouter = createMockRouter({ success: true, content: JSON.stringify(many) });
      service = new WebSearchService(mockLogger, mockRouter);

      const results = await service.search('test', 3);
      expect(results).toHaveLength(3);
    });
  });

  describe('formatResults', () => {
    it('should format results as numbered markdown links', () => {
      const results = [
        { title: 'Test', url: 'https://example.com', snippet: 'A snippet' },
      ];
      const formatted = WebSearchService.formatResults(results);
      expect(formatted).toContain('1.');
      expect(formatted).toContain('[Test](https://example.com)');
      expect(formatted).toContain('A snippet');
    });

    it('should return empty message for no results', () => {
      const formatted = WebSearchService.formatResults([]);
      expect(formatted).toContain('검색 결과가 없습니다');
    });
  });
});
