/**
 * IntentClassifier Tests
 * 3-stage classification: command prefix → keyword heuristic → LLM fallback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentClassifier } from './IntentClassifier.js';
import { SmartRouterLike } from './types.js';

const mockLogger = vi.fn();

describe('IntentClassifier', () => {
  let classifier: IntentClassifier;

  beforeEach(() => {
    mockLogger.mockClear();
    classifier = new IntentClassifier(mockLogger);
  });

  // ========================================================================
  // Stage 1: Explicit command prefix
  // ========================================================================

  describe('Stage 1: Command prefix matching', () => {
    it('should classify /dev prefix as development with confidence 1.0', async () => {
      const result = await classifier.classify('/dev vibe에서 테스트 만들어줘');
      expect(result.category).toBe('development');
      expect(result.confidence).toBe(1.0);
      expect(result.rawQuery).toBe('vibe에서 테스트 만들어줘');
    });

    it('should classify /google prefix as google', async () => {
      const result = await classifier.classify('/google 메일 보내줘');
      expect(result.category).toBe('google');
      expect(result.confidence).toBe(1.0);
    });

    it('should classify /search prefix as research', async () => {
      const result = await classifier.classify('/search AI 뉴스');
      expect(result.category).toBe('research');
      expect(result.confidence).toBe(1.0);
    });

    it('should classify /util prefix as utility', async () => {
      const result = await classifier.classify('/util 번역해줘');
      expect(result.category).toBe('utility');
      expect(result.confidence).toBe(1.0);
    });

    it('should classify /monitor prefix as monitor', async () => {
      const result = await classifier.classify('/monitor 스케줄 목록');
      expect(result.category).toBe('monitor');
      expect(result.confidence).toBe(1.0);
    });
  });

  // ========================================================================
  // Stage 2: Keyword heuristic
  // ========================================================================

  describe('Stage 2: Keyword heuristic (Korean)', () => {
    it('should classify Korean dev keywords', async () => {
      const result = await classifier.classify('vibe 프로젝트 버그 수정해줘');
      expect(result.category).toBe('development');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should classify Korean google keywords', async () => {
      const result = await classifier.classify('메일 보내줘');
      expect(result.category).toBe('google');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should classify Korean research keywords', async () => {
      const result = await classifier.classify('AI 뉴스 검색해줘');
      expect(result.category).toBe('research');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should classify Korean utility keywords', async () => {
      const result = await classifier.classify('번역해줘: Hello world');
      expect(result.category).toBe('utility');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should classify Korean monitor keywords', async () => {
      const result = await classifier.classify('매일 9시에 알림 보내줘');
      expect(result.category).toBe('monitor');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should classify composite when 2+ categories match', async () => {
      const result = await classifier.classify('검색해서 메일로 보내줘');
      expect(result.category).toBe('composite');
      expect(result.subIntents).toBeDefined();
      expect(result.subIntents!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Stage 2: Keyword heuristic (English)', () => {
    it('should classify English dev keywords', async () => {
      const result = await classifier.classify('fix the test code');
      expect(result.category).toBe('development');
    });

    it('should classify English research keywords', async () => {
      const result = await classifier.classify('search for latest news');
      expect(result.category).toBe('research');
    });
  });

  // ========================================================================
  // Stage 3: LLM fallback
  // ========================================================================

  describe('Stage 3: LLM fallback', () => {
    it('should use LLM when keyword confidence is low', async () => {
      const mockRouter: SmartRouterLike = {
        route: vi.fn().mockResolvedValue({
          content: 'development',
          success: true,
        }),
      };

      classifier = new IntentClassifier(mockLogger, mockRouter);
      const result = await classifier.classify('프로젝트 상태 확인해볼까');

      // If keyword heuristic matches, LLM won't be called
      // If not, LLM should classify
      expect(['development', 'conversation', 'research', 'monitor']).toContain(result.category);
    });

    it('should fallback to conversation when LLM returns invalid category', async () => {
      const mockRouter: SmartRouterLike = {
        route: vi.fn().mockResolvedValue({
          content: 'invalid_category',
          success: true,
        }),
      };

      classifier = new IntentClassifier(mockLogger, mockRouter);
      const result = await classifier.classify('안녕 오늘 기분이 어때');
      expect(result.category).toBe('conversation');
    });

    it('should fallback to conversation when LLM fails', async () => {
      const mockRouter: SmartRouterLike = {
        route: vi.fn().mockRejectedValue(new Error('LLM error')),
      };

      classifier = new IntentClassifier(mockLogger, mockRouter);
      const result = await classifier.classify('무작위 텍스트');
      expect(result.category).toBe('conversation');
    });
  });

  // ========================================================================
  // Conversation fallback
  // ========================================================================

  describe('Conversation fallback', () => {
    it('should classify unrecognized text as conversation', async () => {
      const result = await classifier.classify('안녕, 오늘 날씨 어때?');
      expect(result.category).toBe('conversation');
      expect(result.confidence).toBeLessThan(0.7);
    });
  });
});
