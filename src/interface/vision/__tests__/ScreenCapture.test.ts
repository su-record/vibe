/**
 * Unit tests for ScreenCapture
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ScreenCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exports', () => {
    it('exports ScreenCapture class', async () => {
      const mod = await import('../ScreenCapture.js');
      expect(mod.ScreenCapture).toBeDefined();
      expect(typeof mod.ScreenCapture.capture).toBe('function');
    });
  });

  describe('flood protection', () => {
    it('enforces minimum interval via static property', async () => {
      const { ScreenCapture } = await import('../ScreenCapture.js');
      // Access the private static MIN_INTERVAL_MS
      expect(ScreenCapture['MIN_INTERVAL_MS']).toBe(1000);
    });
  });
});
