/**
 * ResultFormatter Tests — Phase 6-7
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResultFormatter } from './ResultFormatter.js';
import type { IntegrationLogger, CommandResult } from './types.js';

// ============================================================================
// Tests
// ============================================================================

describe('ResultFormatter', () => {
  let logger: IntegrationLogger;
  let formatter: ResultFormatter;

  beforeEach(() => {
    logger = vi.fn() as IntegrationLogger;
    formatter = new ResultFormatter(logger);
  });

  describe('format — success', () => {
    const baseResult: CommandResult = {
      success: true,
      module: 'browser',
      data: { text: '검색 결과입니다.' },
      durationMs: 150,
    };

    it('Telegram: Markdown 포맷', () => {
      const formatted = formatter.format(baseResult, 'telegram');
      expect(formatted.channel).toBe('telegram');
      expect(formatted.text).toContain('검색 결과');
      expect(formatted.markdown).toBeDefined();
    });

    it('Slack: Block Kit 포맷', () => {
      const formatted = formatter.format(baseResult, 'slack');
      expect(formatted.channel).toBe('slack');
      expect(formatted.blocks).toBeDefined();
      expect(Array.isArray(formatted.blocks)).toBe(true);
      expect((formatted.blocks as unknown[]).length).toBeGreaterThan(0);
    });

    it('Voice: TTS 텍스트 포맷', () => {
      const formatted = formatter.format(baseResult, 'voice');
      expect(formatted.channel).toBe('voice');
      expect(formatted.ttsText).toBeDefined();
    });

    it('Web: JSON 포맷', () => {
      const formatted = formatter.format(baseResult, 'web');
      expect(formatted.channel).toBe('web');
      const parsed = JSON.parse(formatted.text);
      expect(parsed.text).toBe('검색 결과입니다.');
    });
  });

  describe('format — error', () => {
    const errorResult: CommandResult = {
      success: false,
      module: 'browser',
      error: '브라우저 연결 실패',
      durationMs: 0,
    };

    it('에러 메시지 + 재시도 안내', () => {
      const formatted = formatter.format(errorResult, 'telegram');
      expect(formatted.text).toContain('브라우저 연결 실패');
      expect(formatted.text).toContain('다시 시도');
    });

    it('Voice 에러: TTS 텍스트', () => {
      const formatted = formatter.format(errorResult, 'voice');
      expect(formatted.ttsText).toContain('브라우저 연결 실패');
    });

    it('Slack 에러: Block Kit', () => {
      const formatted = formatter.format(errorResult, 'slack');
      expect(formatted.blocks).toBeDefined();
    });
  });

  describe('summarize', () => {
    it('짧은 텍스트는 그대로', () => {
      expect(formatter.summarize('한 문장.')).toBe('한 문장.');
    });

    it('3문장 이내로 요약', () => {
      const text = '첫 번째 문장. 두 번째 문장. 세 번째 문장. 네 번째 문장. 다섯 번째 문장.';
      const summary = formatter.summarize(text);
      const sentences = summary.split(/[.]+/).filter(s => s.trim().length > 0);
      expect(sentences.length).toBeLessThanOrEqual(3);
    });
  });

  describe('truncate', () => {
    it('짧은 텍스트는 그대로', () => {
      expect(formatter.truncate('hello')).toBe('hello');
    });

    it('긴 텍스트는 ... 으로 잘림', () => {
      const long = 'a'.repeat(5000);
      const truncated = formatter.truncate(long, 100);
      expect(truncated.length).toBe(100);
      expect(truncated.endsWith('...')).toBe(true);
    });
  });

  describe('다양한 data 형태', () => {
    it('string data', () => {
      const result: CommandResult = { success: true, module: 'general', data: '직접 텍스트', durationMs: 0 };
      const formatted = formatter.format(result, 'telegram');
      expect(formatted.text).toBe('직접 텍스트');
    });

    it('message 필드', () => {
      const result: CommandResult = { success: true, module: 'general', data: { message: '메시지 텍스트' }, durationMs: 0 };
      const formatted = formatter.format(result, 'telegram');
      expect(formatted.text).toBe('메시지 텍스트');
    });

    it('복잡한 객체는 JSON', () => {
      const result: CommandResult = { success: true, module: 'general', data: { a: 1, b: 2 }, durationMs: 0 };
      const formatted = formatter.format(result, 'telegram');
      expect(formatted.text).toContain('"a"');
    });

    it('data 없으면 기본 메시지', () => {
      const result: CommandResult = { success: true, module: 'browser', durationMs: 100 };
      const formatted = formatter.format(result, 'telegram');
      expect(formatted.text).toContain('browser');
      expect(formatted.text).toContain('100ms');
    });
  });
});
