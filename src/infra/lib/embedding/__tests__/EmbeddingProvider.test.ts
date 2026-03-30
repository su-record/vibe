import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmbeddingProvider } from '../EmbeddingProvider.js';

vi.mock('../../config/GlobalConfigManager.js', () => ({
  getGptApiKey: vi.fn().mockReturnValue(null),
  readGlobalConfig: vi.fn().mockReturnValue({ version: '1' }),
}));

describe('EmbeddingProvider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('isAvailable', () => {
    it('should return false when no API keys are set', () => {
      const provider = new EmbeddingProvider();
      expect(provider.isAvailable()).toBe(false);
    });

    it('should return true when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const provider = new EmbeddingProvider();
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe('embed', () => {
    it('should return empty for empty input', async () => {
      const provider = new EmbeddingProvider();
      const result = await provider.embed([]);
      expect(result.embeddings).toHaveLength(0);
    });

    it('should throw when no providers available', async () => {
      const provider = new EmbeddingProvider();
      await expect(provider.embed(['test'])).rejects.toThrow(
        'All embedding providers failed',
      );
    });

    it('should accept custom dimensions config', () => {
      const provider = new EmbeddingProvider({ dimensions: 512 });
      expect(provider.isAvailable()).toBe(false); // no keys
    });
  });
});
