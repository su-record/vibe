/**
 * SmartRouter Tests - LLM smart routing and fallback management
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { SmartRouter, AllProvidersFailedError, getSmartRouter } from './SmartRouter.js';

// Mock external LLM APIs
vi.mock('../lib/gpt/index.js', () => ({
  coreGptOrchestrate: vi.fn(),
}));
vi.mock('../lib/gemini/index.js', () => ({
  coreGeminiOrchestrate: vi.fn(),
}));
vi.mock('../lib/utils.js', () => ({
  debugLog: vi.fn(),
}));
// Dynamic priority: codex=true, gemini=true
// architecture → ['gpt', 'gemini', 'claude']
// debugging → ['gpt', 'claude']
// code-analysis → ['gpt', 'claude']
// code-gen → ['gpt', 'claude']
// code-review → ['gpt', 'gemini', 'claude']
// web-search → ['gemini', 'claude']
// uiux → ['gemini', 'claude']
// general → ['claude'] (not in any codex/gemini list)
// reasoning → ['gpt', 'gemini', 'claude']
vi.mock('../lib/llm-availability.js', () => ({
  detectLlmAvailability: vi.fn(() => ({ codex: true, gemini: true })),
}));

// Import mocked modules
import { coreGptOrchestrate } from '../lib/gpt/index.js';
import { coreGeminiOrchestrate } from '../lib/gemini/index.js';

const mockGpt = coreGptOrchestrate as Mock;
const mockGemini = coreGeminiOrchestrate as Mock;

describe('SmartRouter', () => {
  let router: SmartRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    router = new SmartRouter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Provider Selection Based on Task Type ───

  describe('provider selection by task type', () => {
    it('should use GPT first for architecture tasks', async () => {
      mockGpt.mockResolvedValueOnce('GPT architecture response');

      const result = await router.route({
        type: 'architecture',
        prompt: 'Review this architecture',
      });

      expect(result.provider).toBe('gpt');
      expect(result.content).toBe('GPT architecture response');
      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(false);
      expect(mockGpt).toHaveBeenCalledOnce();
      expect(mockGemini).not.toHaveBeenCalled();
    });

    it('should use GPT first for debugging tasks', async () => {
      mockGpt.mockResolvedValueOnce('GPT debug response');

      const result = await router.route({
        type: 'debugging',
        prompt: 'Debug this issue',
      });

      expect(result.provider).toBe('gpt');
      expect(result.success).toBe(true);
    });

    it('should use GPT first for code-analysis tasks', async () => {
      mockGpt.mockResolvedValueOnce('GPT analysis');

      const result = await router.route({
        type: 'code-analysis',
        prompt: 'Analyze this code',
      });

      expect(result.provider).toBe('gpt');
    });

    it('should use Gemini first for web-search tasks', async () => {
      mockGemini.mockResolvedValueOnce('Gemini search result');

      const result = await router.route({
        type: 'web-search',
        prompt: 'Search for something',
      });

      expect(result.provider).toBe('gemini');
      expect(result.content).toBe('Gemini search result');
      expect(mockGemini).toHaveBeenCalledOnce();
      expect(mockGpt).not.toHaveBeenCalled();
    });

    it('should use Gemini first for uiux tasks', async () => {
      mockGemini.mockResolvedValueOnce('Gemini UI feedback');

      const result = await router.route({
        type: 'uiux',
        prompt: 'Review this UI',
      });

      expect(result.provider).toBe('gemini');
      expect(result.content).toBe('Gemini UI feedback');
    });

    it('should respect preferredLlm override', async () => {
      mockGemini.mockResolvedValueOnce('Gemini response');

      const result = await router.route({
        type: 'architecture', // normally GPT-first
        prompt: 'Review this',
        preferredLlm: 'gemini',
      });

      expect(result.provider).toBe('gemini');
      expect(result.content).toBe('Gemini response');
      expect(mockGpt).not.toHaveBeenCalled();
    });

    it('should use GPT first for code-review tasks', async () => {
      mockGpt.mockResolvedValueOnce('GPT code review');

      const result = await router.route({
        type: 'code-review',
        prompt: 'Review this code',
      });

      expect(result.provider).toBe('gpt');
    });

    it('should use GPT first for reasoning tasks', async () => {
      mockGpt.mockResolvedValueOnce('GPT reasoning');

      const result = await router.route({
        type: 'reasoning',
        prompt: 'Reason about this',
      });

      expect(result.provider).toBe('gpt');
    });
  });

  // ─── Fallback Chain ───

  describe('fallback chain', () => {
    it('should fall back to Gemini when GPT fails for architecture', async () => {
      // architecture: ['gpt', 'gemini', 'claude']
      mockGpt.mockRejectedValueOnce(new Error('GPT rate limit exceeded'));
      mockGemini.mockResolvedValueOnce('Gemini fallback response');

      const result = await router.route({
        type: 'architecture',
        prompt: 'Review this',
        maxRetries: 0,
      });

      expect(result.provider).toBe('gemini');
      expect(result.content).toBe('Gemini fallback response');
      expect(result.usedFallback).toBe(true);
      expect(result.attemptedProviders).toContain('gpt');
      expect(result.attemptedProviders).toContain('gemini');
    });

    it('should fall back to GPT when Gemini fails for code-review with preferredLlm', async () => {
      // code-review: ['gpt', 'gemini', 'claude'] — override with preferredLlm=gemini → ['gemini', 'gpt', 'claude']
      mockGemini.mockRejectedValueOnce(new Error('Gemini quota exhausted'));
      mockGpt.mockResolvedValueOnce('GPT fallback');

      const result = await router.route({
        type: 'code-review',
        prompt: 'Review code',
        preferredLlm: 'gemini',
        maxRetries: 0,
      });

      expect(result.provider).toBe('gpt');
      expect(result.usedFallback).toBe(true);
    });

    it('should skip retries for auth errors and move to next provider', async () => {
      // architecture: ['gpt', 'gemini', 'claude']
      mockGpt.mockRejectedValueOnce(new Error('No API key set'));
      mockGemini.mockResolvedValueOnce('Gemini response');

      const result = await router.route({
        type: 'architecture',
        prompt: 'Analyze code',
        maxRetries: 2,
      });

      // GPT should only be called once (no retries for auth errors)
      expect(mockGpt).toHaveBeenCalledTimes(1);
      expect(result.provider).toBe('gemini');
      expect(result.usedFallback).toBe(true);
    });

    it('should skip retries for rate limit errors (429)', async () => {
      // code-review: ['gpt', 'gemini', 'claude']
      mockGpt.mockRejectedValueOnce(new Error('429 Too Many Requests'));
      mockGemini.mockResolvedValueOnce('OK');

      await router.route({
        type: 'code-review',
        prompt: 'Test',
        maxRetries: 2,
      });

      expect(mockGpt).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient errors before falling back', async () => {
      // architecture: ['gpt', 'gemini', 'claude']
      mockGpt
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce('GPT recovered');

      const result = await router.route({
        type: 'architecture',
        prompt: 'Test',
        maxRetries: 2,
      });

      expect(mockGpt).toHaveBeenCalledTimes(3); // initial + 2 retries
      expect(result.provider).toBe('gpt');
      expect(result.usedFallback).toBe(false);
    });

    it('should use custom systemPrompt when provided', async () => {
      // architecture: ['gpt', 'gemini', 'claude']
      mockGpt.mockResolvedValueOnce('Response');

      await router.route({
        type: 'architecture',
        prompt: 'Test prompt',
        systemPrompt: 'Custom system prompt',
      });

      expect(mockGpt).toHaveBeenCalledWith(
        'Test prompt',
        'Custom system prompt',
        { jsonMode: false },
      );
    });

    it('should use default systemPrompt when not provided', async () => {
      // architecture: ['gpt', 'gemini', 'claude']
      mockGpt.mockResolvedValueOnce('Response');

      await router.route({
        type: 'architecture',
        prompt: 'Test prompt',
      });

      expect(mockGpt).toHaveBeenCalledWith(
        'Test prompt',
        'You are a helpful assistant.',
        { jsonMode: false },
      );
    });
  });

  // ─── Availability Caching (5min TTL) ───

  describe('availability caching', () => {
    it('should skip providers marked as unavailable', async () => {
      // code-review: ['gpt', 'gemini', 'claude']
      // Fail GPT with rate-limit (skip-retry pattern) to quickly mark unavailable
      mockGpt.mockRejectedValue(new Error('GPT server error'));
      mockGemini.mockResolvedValue('Gemini response');

      // Route 3 times with maxRetries=0 to accumulate 3 error counts on GPT
      await router.route({ type: 'code-review', prompt: 'test1', maxRetries: 0 });
      await router.route({ type: 'code-review', prompt: 'test2', maxRetries: 0 });
      await router.route({ type: 'code-review', prompt: 'test3', maxRetries: 0 });

      // After 3 failures, GPT is marked unavailable
      const cache = router.getCacheStatus();
      expect(cache.gpt.errorCount).toBeGreaterThanOrEqual(3);
      expect(cache.gpt.available).toBe(false);

      // Reset call counts
      mockGpt.mockClear();
      mockGemini.mockClear();
      mockGemini.mockResolvedValueOnce('Gemini from cache');

      // Next route should skip GPT entirely
      const result = await router.route({
        type: 'code-review',
        prompt: 'test4',
        maxRetries: 0,
      });

      expect(mockGpt).not.toHaveBeenCalled();
      expect(result.provider).toBe('gemini');
    });

    it('should reset availability after TTL expires', async () => {
      // code-review: ['gpt', 'gemini', 'claude']
      mockGpt.mockRejectedValue(new Error('GPT server error'));
      mockGemini.mockResolvedValue('Gemini');

      // Accumulate 3 failures
      await router.route({ type: 'code-review', prompt: 'test', maxRetries: 0 });
      await router.route({ type: 'code-review', prompt: 'test', maxRetries: 0 });
      await router.route({ type: 'code-review', prompt: 'test', maxRetries: 0 });

      expect(router.getCacheStatus().gpt.available).toBe(false);

      // Simulate TTL expiry by advancing time
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now + 5 * 60 * 1000 + 1); // 5min + 1ms

      mockGpt.mockClear();
      mockGpt.mockResolvedValueOnce('GPT recovered');

      const result = await router.route({
        type: 'code-review',
        prompt: 'test',
      });

      expect(mockGpt).toHaveBeenCalled();
      expect(result.provider).toBe('gpt');

      vi.useRealTimers();
    });

    it('should mark provider available on success', async () => {
      // architecture: ['gpt', 'gemini', 'claude']
      mockGpt.mockResolvedValueOnce('GPT OK');

      await router.route({ type: 'architecture', prompt: 'test' });

      const cache = router.getCacheStatus();
      expect(cache.gpt.available).toBe(true);
      expect(cache.gpt.errorCount).toBe(0);
    });

    it('should reset cache via resetCache()', () => {
      const router2 = new SmartRouter();
      const cache = router2.getCacheStatus();
      expect(cache.gpt.available).toBe(true);
      expect(cache.gemini.available).toBe(true);

      router2.resetCache();
      const reset = router2.getCacheStatus();
      expect(reset.gpt.errorCount).toBe(0);
      expect(reset.gemini.errorCount).toBe(0);
    });

    it('should not cache claude provider availability', async () => {
      // web-search: ['gemini', 'claude'] — claude is always considered available
      mockGemini.mockRejectedValueOnce(new Error('Gemini auth'));

      // claude will fail with "Claude fallback - handled by caller"
      // but isUnavailable('claude') always returns false
      await expect(
        router.route({ type: 'web-search', prompt: 'test', maxRetries: 0 }),
      ).rejects.toThrow(AllProvidersFailedError);

      // claude should still be "available" (not cached)
      // Verify by checking that subsequent calls still attempt claude
      mockGemini.mockRejectedValueOnce(new Error('Gemini auth'));
      const errorPromise = router.route({ type: 'web-search', prompt: 'test', maxRetries: 0 });
      await expect(errorPromise).rejects.toThrow(AllProvidersFailedError);
    });
  });

  // ─── Edge Cases ───

  describe('edge cases', () => {
    it('should throw AllProvidersFailedError when all providers fail', async () => {
      // architecture: ['gpt', 'gemini', 'claude']
      mockGpt.mockRejectedValueOnce(new Error('GPT auth failure'));
      mockGemini.mockRejectedValueOnce(new Error('Gemini auth failure'));

      await expect(
        router.route({
          type: 'architecture',
          prompt: 'Test',
          maxRetries: 0,
        }),
      ).rejects.toThrow(AllProvidersFailedError);
    });

    it('AllProvidersFailedError should contain attempted providers and errors', async () => {
      // architecture: ['gpt', 'gemini', 'claude']
      mockGpt.mockRejectedValueOnce(new Error('GPT unauthorized'));
      mockGemini.mockRejectedValueOnce(new Error('Gemini unauthorized'));

      try {
        await router.route({
          type: 'architecture',
          prompt: 'Test',
          maxRetries: 0,
        });
        expect.fail('Should have thrown');
      } catch (err) {
        const error = err as AllProvidersFailedError;
        expect(error).toBeInstanceOf(AllProvidersFailedError);
        expect(error.attemptedProviders).toContain('gpt');
        expect(error.attemptedProviders).toContain('gemini');
        expect(error.errors['gpt']).toContain('GPT unauthorized');
        expect(error.errors['gemini']).toContain('Gemini unauthorized');
        expect(error.duration).toBeGreaterThanOrEqual(0);
        expect(error.name).toBe('AllProvidersFailedError');
      }
    });

    it('should handle claude provider in fallback chain', async () => {
      // architecture: ['gpt', 'gemini', 'claude']
      // claude always throws "Claude fallback - handled by caller"
      mockGpt.mockRejectedValueOnce(new Error('GPT auth'));
      mockGemini.mockRejectedValueOnce(new Error('Gemini auth'));

      try {
        await router.route({
          type: 'architecture',
          prompt: 'Test',
          maxRetries: 0,
        });
        expect.fail('Should have thrown');
      } catch (err) {
        const error = err as AllProvidersFailedError;
        expect(error.attemptedProviders).toContain('claude');
        expect(error.errors['claude']).toContain('Claude fallback');
      }
    });

    it('should track duration in result', async () => {
      mockGpt.mockResolvedValueOnce('Response');

      const result = await router.route({
        type: 'architecture',
        prompt: 'Test',
      });

      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should set maxRetries to 2 by default', async () => {
      // architecture: ['gpt', 'gemini', 'claude']
      mockGpt
        .mockRejectedValueOnce(new Error('Transient error 1'))
        .mockRejectedValueOnce(new Error('Transient error 2'))
        .mockResolvedValueOnce('Success on third attempt');

      const result = await router.route({
        type: 'architecture',
        prompt: 'Test',
        // maxRetries not specified — default is 2
      });

      expect(mockGpt).toHaveBeenCalledTimes(3);
      expect(result.provider).toBe('gpt');
      expect(result.success).toBe(true);
    });

    it('should report attemptedProviders length of 1 when first provider succeeds', async () => {
      mockGpt.mockResolvedValueOnce('OK');

      const result = await router.route({
        type: 'architecture',
        prompt: 'Test',
      });

      expect(result.attemptedProviders).toEqual(['gpt']);
      expect(result.usedFallback).toBe(false);
    });
  });

  // ─── Convenience Methods ───

  describe('convenience methods', () => {
    it('webSearch should route with web-search type', async () => {
      mockGemini.mockResolvedValueOnce('Search results');

      const result = await router.webSearch('test query');

      expect(result.provider).toBe('gemini');
      expect(result.content).toBe('Search results');
    });

    it('architectureReview should route with architecture type', async () => {
      mockGpt.mockResolvedValueOnce('Architecture analysis');

      const result = await router.architectureReview('Review this');

      expect(result.provider).toBe('gpt');
    });

    it('uiuxReview should route with uiux type', async () => {
      mockGemini.mockResolvedValueOnce('UI feedback');

      const result = await router.uiuxReview('Review UI');

      expect(result.provider).toBe('gemini');
    });

    it('codeAnalysis should route with code-analysis type', async () => {
      mockGpt.mockResolvedValueOnce('Code analysis');

      const result = await router.codeAnalysis('Analyze');

      expect(result.provider).toBe('gpt');
    });

    it('debugging should route with debugging type', async () => {
      mockGpt.mockResolvedValueOnce('Debug info');

      const result = await router.debugging('Debug this');

      expect(result.provider).toBe('gpt');
    });

    it('codeGen should route with code-gen type', async () => {
      mockGpt.mockResolvedValueOnce('Generated code');

      const result = await router.codeGen('Generate a function');

      expect(result.provider).toBe('gpt');
    });

    it('codeGen should include context when provided', async () => {
      mockGpt.mockResolvedValueOnce('Generated code');

      await router.codeGen('Generate a function', 'Some context');

      expect(mockGpt).toHaveBeenCalledWith(
        'Generate a function\n\nContext:\nSome context',
        'Generate clean, well-documented code.',
        { jsonMode: false },
      );
    });
  });

  // ─── Singleton ───

  describe('getSmartRouter singleton', () => {
    it('should return a SmartRouter instance', () => {
      const instance = getSmartRouter();
      expect(instance).toBeInstanceOf(SmartRouter);
    });

    it('should create new instance when options are provided', () => {
      const instance1 = getSmartRouter();
      const instance2 = getSmartRouter({ verbose: true });
      expect(instance2).toBeInstanceOf(SmartRouter);
    });
  });

  // ─── AllProvidersFailedError ───

  describe('AllProvidersFailedError', () => {
    it('should format message with last provider error', () => {
      const error = new AllProvidersFailedError(
        ['gpt', 'gemini'],
        { gpt: 'GPT failed', gemini: 'Gemini failed' },
        1500,
      );

      expect(error.message).toContain('gemini');
      expect(error.message).toContain('Gemini failed');
      expect(error.attemptedProviders).toEqual(['gpt', 'gemini']);
      expect(error.duration).toBe(1500);
    });

    it('should handle empty providers list', () => {
      const error = new AllProvidersFailedError([], {}, 100);
      expect(error.message).toContain('No providers attempted');
    });
  });

  // ─── Verbose mode ───

  describe('verbose mode', () => {
    it('should create router with verbose option', () => {
      const verboseRouter = new SmartRouter({ verbose: true });
      expect(verboseRouter).toBeInstanceOf(SmartRouter);
    });
  });
});
