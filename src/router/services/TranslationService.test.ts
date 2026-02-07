/**
 * TranslationService Tests
 * Auto language detection + chunked translation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranslationService } from './TranslationService.js';
import { SmartRouterLike } from '../types.js';

const mockLogger = vi.fn();

function createMockRouter(translated: string = 'Translated text'): SmartRouterLike {
  return {
    route: vi.fn().mockResolvedValue({ success: true, content: translated }),
  } as unknown as SmartRouterLike;
}

describe('TranslationService', () => {
  let service: TranslationService;
  let mockRouter: SmartRouterLike;

  beforeEach(() => {
    mockLogger.mockClear();
    mockRouter = createMockRouter();
    service = new TranslationService(mockLogger, mockRouter);
  });

  describe('detectLanguage', () => {
    it('should detect Korean', async () => {
      expect(await service.detectLanguage('안녕하세요')).toBe('ko');
    });

    it('should detect English', async () => {
      expect(await service.detectLanguage('Hello world')).toBe('en');
    });

    it('should detect Japanese', async () => {
      expect(await service.detectLanguage('こんにちは')).toBe('ja');
    });

    it('should detect Chinese', async () => {
      expect(await service.detectLanguage('你好世界')).toBe('zh');
    });
  });

  describe('translate', () => {
    it('should translate short text', async () => {
      const result = await service.translate('안녕하세요');
      expect(result).toBe('Translated text');
      expect(mockRouter.route).toHaveBeenCalledOnce();
    });

    it('should use specified target language', async () => {
      await service.translate('Hello', 'ja');
      const call = (mockRouter.route as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.systemPrompt).toContain('일본어');
    });

    it('should chunk long text', async () => {
      const longText = '안녕하세요 '.repeat(5000);
      await service.translate(longText);
      const callCount = (mockRouter.route as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(callCount).toBeGreaterThan(1);
    });

    it('should throw on LLM failure', async () => {
      mockRouter = {
        route: vi.fn().mockResolvedValue({ success: false, content: '' }),
      } as unknown as SmartRouterLike;
      service = new TranslationService(mockLogger, mockRouter);

      await expect(service.translate('test')).rejects.toThrow('번역에 실패했습니다');
    });
  });
});
