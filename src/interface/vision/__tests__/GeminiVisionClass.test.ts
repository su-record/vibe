/**
 * Unit tests for GeminiVision
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock https module
const mockRequest = vi.fn();
vi.mock('node:https', () => ({
  default: {
    request: mockRequest,
  },
}));

// Mock auth module
vi.mock('../../../lib/gemini/auth.js', () => ({
  getApiKeyFromConfig: vi.fn(() => 'test-api-key'),
}));

describe('GeminiVision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('initializes with API key', async () => {
      const { GeminiVision } = await import('../GeminiVisionClass.js');
      const vision = new GeminiVision('test-key');
      expect(vision).toBeDefined();
    });
  });

  describe('rate limiting', () => {
    it('enforces rate limit per minute', async () => {
      const { GeminiVision } = await import('../GeminiVisionClass.js');
      const vision = new GeminiVision('test-key');

      // Consume all tokens
      vision['tokenBucket'].tokens = 0;

      // Should wait when no tokens available
      const waitPromise = vision['waitForToken']();
      expect(waitPromise).toBeInstanceOf(Promise);
    });

    it('refills tokens after time passes', async () => {
      const { GeminiVision } = await import('../GeminiVisionClass.js');
      const vision = new GeminiVision('test-key');

      // Set last refill to past
      vision['tokenBucket'].lastRefill = Date.now() - 70000; // 70 seconds ago

      vision['refillTokenBucket']();

      expect(vision['tokenBucket'].tokens).toBe(10);
    });
  });

  describe('image validation', () => {
    it('resizes image if too large', async () => {
      const { GeminiVision } = await import('../GeminiVisionClass.js');
      const vision = new GeminiVision('test-key');

      const largeImage = Buffer.alloc(5 * 1024 * 1024); // 5MB
      const resized = vision['resizeImageIfNeeded'](largeImage);

      expect(resized.length).toBeLessThanOrEqual(4 * 1024 * 1024);
    });

    it('keeps image as-is if within limit', async () => {
      const { GeminiVision } = await import('../GeminiVisionClass.js');
      const vision = new GeminiVision('test-key');

      const smallImage = Buffer.alloc(1024); // 1KB
      const resized = vision['resizeImageIfNeeded'](smallImage);

      expect(resized).toBe(smallImage);
    });
  });

  describe('session management', () => {
    it('starts live session', async () => {
      const { GeminiVision } = await import('../GeminiVisionClass.js');
      const vision = new GeminiVision('test-key');

      vision.startLiveSession('analyze this');

      expect(vision['liveSession'].isActive).toBe(true);
      expect(vision['liveSession'].prompt).toBe('analyze this');
    });

    it('throws if starting session when already active', async () => {
      const { GeminiVision } = await import('../GeminiVisionClass.js');
      const vision = new GeminiVision('test-key');

      vision.startLiveSession('prompt 1');

      expect(() => vision.startLiveSession('prompt 2')).toThrow('already active');
    });

    it('stops live session', async () => {
      const { GeminiVision } = await import('../GeminiVisionClass.js');
      const vision = new GeminiVision('test-key');

      vision.startLiveSession('test');
      vision.stopLiveSession();

      expect(vision['liveSession'].isActive).toBe(false);
    });

    it('handles stop on inactive session', async () => {
      const { GeminiVision } = await import('../GeminiVisionClass.js');
      const vision = new GeminiVision('test-key');

      // Should not throw
      vision.stopLiveSession();

      expect(vision['liveSession'].isActive).toBe(false);
    });
  });
});
