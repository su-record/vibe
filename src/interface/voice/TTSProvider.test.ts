/**
 * TTS Provider Chain Tests
 *
 * Provider availability, text chunking, fallback logic.
 * (No API calls — all mocked)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EdgeTTSProvider,
  OpenAITTSProvider,
  GoogleTTSProvider,
  TTSProviderChain,
  chunkText,
  getDefaultTTSConfigs,
} from './TTSProvider.js';
import type { VoiceLogger, TTSProviderConfig } from './types.js';

function createLogger(): VoiceLogger {
  return vi.fn();
}

describe('TTS Provider Availability', () => {
  it('EdgeTTSProvider should always be available', () => {
    const provider = new EdgeTTSProvider({
      name: 'edge', enabled: true, timeoutMs: 5000,
    });
    expect(provider.isAvailable()).toBe(true);
    expect(provider.name).toBe('edge');
  });

  it('OpenAITTSProvider should be unavailable without API key', () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const provider = new OpenAITTSProvider({
      name: 'openai', enabled: true, timeoutMs: 5000, apiKey: '',
    });
    expect(provider.isAvailable()).toBe(false);

    process.env.OPENAI_API_KEY = originalKey;
  });

  it('OpenAITTSProvider should be available with API key', () => {
    const provider = new OpenAITTSProvider({
      name: 'openai', enabled: true, timeoutMs: 5000, apiKey: 'test-key',
    });
    expect(provider.isAvailable()).toBe(true);
  });

  it('GoogleTTSProvider should be unavailable without API key', () => {
    const originalKey = process.env.GOOGLE_TTS_API_KEY;
    delete process.env.GOOGLE_TTS_API_KEY;

    const provider = new GoogleTTSProvider({
      name: 'google', enabled: true, timeoutMs: 5000, apiKey: '',
    });
    expect(provider.isAvailable()).toBe(false);

    process.env.GOOGLE_TTS_API_KEY = originalKey;
  });
});

describe('TTSProviderChain', () => {
  let logger: VoiceLogger;

  beforeEach(() => {
    logger = createLogger();
  });

  it('should filter out disabled providers', () => {
    const configs: TTSProviderConfig[] = [
      { name: 'edge', enabled: false, timeoutMs: 5000 },
      { name: 'openai', enabled: true, timeoutMs: 5000, apiKey: 'key1' },
    ];
    const chain = new TTSProviderChain(configs, logger);
    const available = chain.getAvailableProviders();
    expect(available).not.toContain('edge');
  });

  it('should return available providers', () => {
    const configs: TTSProviderConfig[] = [
      { name: 'edge', enabled: true, timeoutMs: 5000 },
      { name: 'openai', enabled: true, timeoutMs: 5000, apiKey: '' },
    ];
    const chain = new TTSProviderChain(configs, logger);
    const available = chain.getAvailableProviders();
    expect(available).toContain('edge');
    expect(available).not.toContain('openai'); // no API key
  });

  it('should throw ALL_PROVIDERS_FAILED when all fail', async () => {
    const configs: TTSProviderConfig[] = [
      { name: 'edge', enabled: true, timeoutMs: 100 },
    ];
    const chain = new TTSProviderChain(configs, logger);

    // Mock edge-tts import to fail
    const originalImport = vi.fn();
    vi.doMock('node-edge-tts', () => {
      throw new Error('Module not found');
    });

    // Edge TTS will fail when node-edge-tts is not installed
    await expect(
      chain.synthesize('Test text'),
    ).rejects.toThrow('모든 TTS 프로바이더가 실패했습니다');
  });
});

describe('chunkText', () => {
  it('should return single chunk for short text', () => {
    const chunks = chunkText('Hello world', 4096);
    expect(chunks).toEqual(['Hello world']);
  });

  it('should return single chunk when text equals max', () => {
    const text = 'A'.repeat(4096);
    const chunks = chunkText(text, 4096);
    expect(chunks).toEqual([text]);
  });

  it('should split on sentence boundaries', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const chunks = chunkText(text, 30);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => c.length <= 30 || c.split('.').length <= 2)).toBe(true);
  });

  it('should handle Korean sentences', () => {
    const text = '첫 번째 문장입니다. 두 번째 문장입니다. 세 번째 문장입니다.';
    const chunks = chunkText(text, 25);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should handle text with newlines', () => {
    const text = 'Line 1\nLine 2\nLine 3';
    const chunks = chunkText(text, 10);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should handle empty text', () => {
    const chunks = chunkText('', 4096);
    expect(chunks).toEqual(['']);
  });

  it('should use default maxChars of 4096', () => {
    const shortText = 'Hello';
    const chunks = chunkText(shortText);
    expect(chunks).toEqual(['Hello']);
  });

  it('should handle question marks and exclamation marks', () => {
    const text = 'Is this a question? Yes it is! And here is more.';
    const chunks = chunkText(text, 25);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('getDefaultTTSConfigs', () => {
  it('should return 3 providers', () => {
    const configs = getDefaultTTSConfigs();
    expect(configs).toHaveLength(3);
  });

  it('should have edge as first provider', () => {
    const configs = getDefaultTTSConfigs();
    expect(configs[0].name).toBe('edge');
  });

  it('should have Korean voice for edge', () => {
    const configs = getDefaultTTSConfigs();
    const edge = configs.find(c => c.name === 'edge');
    expect(edge?.voice).toBe('ko-KR-SunHiNeural');
  });

  it('should have all enabled by default', () => {
    const configs = getDefaultTTSConfigs();
    expect(configs.every(c => c.enabled)).toBe(true);
  });
});
