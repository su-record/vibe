/**
 * Unit tests for VisionInterface
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InterfaceLogger } from '../../types.js';

// Mock GeminiVisionClass BEFORE importing VisionInterface
vi.mock('../GeminiVisionClass.js', () => {
  class MockGeminiVision {
    analyzeImage = vi.fn().mockResolvedValue('analysis result');
    startLiveSession = vi.fn();
    stopLiveSession = vi.fn();
  }
  return {
    GeminiVision: MockGeminiVision,
  };
});

import { VisionInterface } from '../VisionInterface.js';

describe('VisionInterface', () => {
  const mockLogger: InterfaceLogger = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('initializes with config', () => {
      const vision = new VisionInterface({ enabled: true }, mockLogger);
      expect(vision.name).toBe('vision');
      expect(vision.channel).toBe('vision');
    });
  });

  describe('start', () => {
    it('stays disabled if config.enabled is false', async () => {
      const vision = new VisionInterface({ enabled: false }, mockLogger);
      await vision.start();
      expect(vision.getStatus()).toBe('disabled');
    });

    it('disables if no API key', async () => {
      const origKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      const vision = new VisionInterface({ enabled: true }, mockLogger);
      await vision.start();
      expect(vision.getStatus()).toBe('disabled');
      if (origKey) process.env.GEMINI_API_KEY = origKey;
    });

    it('enables with valid API key', async () => {
      const vision = new VisionInterface(
        { enabled: true, geminiApiKey: 'test-key' },
        mockLogger
      );
      await vision.start();
      expect(vision.getStatus()).toBe('enabled');
    });
  });

  describe('stop', () => {
    it('stops and disables', async () => {
      const vision = new VisionInterface(
        { enabled: true, geminiApiKey: 'test-key' },
        mockLogger
      );
      await vision.start();
      await vision.stop();
      expect(vision.getStatus()).toBe('disabled');
    });
  });
});
