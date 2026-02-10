/**
 * STT Provider Chain Tests
 *
 * Provider availability, circuit breaker, fallback logic.
 * (No API calls — all mocked)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GeminiSTTProvider,
  WhisperSTTProvider,
  DeepgramSTTProvider,
  STTProviderChain,
  getDefaultSTTConfigs,
} from './STTProvider.js';
import type { VoiceLogger, STTProviderConfig } from './types.js';

function createLogger(): VoiceLogger {
  return vi.fn();
}

describe('STT Provider Availability', () => {
  it('GeminiSTTProvider should be unavailable without API key', () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const provider = new GeminiSTTProvider({
      name: 'gemini', enabled: true, timeoutMs: 5000, apiKey: '',
    });
    expect(provider.isAvailable()).toBe(false);
    expect(provider.name).toBe('gemini');

    process.env.GEMINI_API_KEY = originalKey;
  });

  it('GeminiSTTProvider should be available with API key', () => {
    const provider = new GeminiSTTProvider({
      name: 'gemini', enabled: true, timeoutMs: 5000, apiKey: 'test-key',
    });
    expect(provider.isAvailable()).toBe(true);
  });

  it('WhisperSTTProvider should be unavailable without API key', () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const provider = new WhisperSTTProvider({
      name: 'whisper', enabled: true, timeoutMs: 5000, apiKey: '',
    });
    expect(provider.isAvailable()).toBe(false);

    process.env.OPENAI_API_KEY = originalKey;
  });

  it('DeepgramSTTProvider should be unavailable without API key', () => {
    const originalKey = process.env.DEEPGRAM_API_KEY;
    delete process.env.DEEPGRAM_API_KEY;

    const provider = new DeepgramSTTProvider({
      name: 'deepgram', enabled: true, timeoutMs: 5000, apiKey: '',
    });
    expect(provider.isAvailable()).toBe(false);

    process.env.DEEPGRAM_API_KEY = originalKey;
  });
});

describe('STTProviderChain', () => {
  let logger: VoiceLogger;

  beforeEach(() => {
    logger = createLogger();
  });

  it('should filter out disabled providers', () => {
    const configs: STTProviderConfig[] = [
      { name: 'gemini', enabled: false, timeoutMs: 5000, apiKey: 'key1' },
      { name: 'whisper', enabled: true, timeoutMs: 5000, apiKey: 'key2' },
    ];
    const chain = new STTProviderChain(configs, logger);
    const available = chain.getAvailableProviders();
    expect(available).not.toContain('gemini');
  });

  it('should return available providers', () => {
    const configs: STTProviderConfig[] = [
      { name: 'gemini', enabled: true, timeoutMs: 5000, apiKey: 'key1' },
      { name: 'whisper', enabled: true, timeoutMs: 5000, apiKey: 'key2' },
      { name: 'deepgram', enabled: true, timeoutMs: 5000, apiKey: '' },
    ];
    const chain = new STTProviderChain(configs, logger);
    const available = chain.getAvailableProviders();
    expect(available).toContain('gemini');
    expect(available).toContain('whisper');
    expect(available).not.toContain('deepgram'); // no API key
  });

  it('should throw ALL_PROVIDERS_FAILED when all fail', async () => {
    const configs: STTProviderConfig[] = [
      { name: 'gemini', enabled: true, timeoutMs: 100, apiKey: 'bad-key' },
    ];
    const chain = new STTProviderChain(configs, logger);

    // Mock fetch to fail
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    try {
      await expect(
        chain.transcribe(Buffer.alloc(100), 'audio/wav'),
      ).rejects.toThrow('모든 STT 프로바이더가 실패했습니다');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should throw when no providers are available', async () => {
    const configs: STTProviderConfig[] = [
      { name: 'gemini', enabled: true, timeoutMs: 5000, apiKey: '' },
      { name: 'whisper', enabled: true, timeoutMs: 5000, apiKey: '' },
    ];
    const chain = new STTProviderChain(configs, logger);

    await expect(
      chain.transcribe(Buffer.alloc(100), 'audio/wav'),
    ).rejects.toThrow('모든 STT 프로바이더가 실패했습니다');
  });
});

describe('getDefaultSTTConfigs', () => {
  it('should return 3 providers', () => {
    const configs = getDefaultSTTConfigs();
    expect(configs).toHaveLength(3);
  });

  it('should have gemini as first provider', () => {
    const configs = getDefaultSTTConfigs();
    expect(configs[0].name).toBe('gemini');
  });

  it('should have all enabled by default', () => {
    const configs = getDefaultSTTConfigs();
    expect(configs.every(c => c.enabled)).toBe(true);
  });

  it('should have reasonable timeout', () => {
    const configs = getDefaultSTTConfigs();
    expect(configs.every(c => c.timeoutMs >= 5000)).toBe(true);
  });
});

describe('Circuit Breaker', () => {
  it('should open circuit after 3 consecutive failures', async () => {
    const logger = createLogger();
    const configs: STTProviderConfig[] = [
      { name: 'gemini', enabled: true, timeoutMs: 100, apiKey: 'test-key' },
    ];
    const chain = new STTProviderChain(configs, logger);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('fail'));

    try {
      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await chain.transcribe(Buffer.alloc(100), 'audio/wav');
        } catch {
          // expected
        }
      }

      // Circuit should be open — provider excluded from available
      const available = chain.getAvailableProviders();
      expect(available).not.toContain('gemini');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
