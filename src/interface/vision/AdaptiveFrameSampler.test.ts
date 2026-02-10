/**
 * AdaptiveFrameSampler Tests
 *
 * Tests for diff-based frame sampling, FPS limits, and skip behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveFrameSampler } from './AdaptiveFrameSampler.js';
import type { VisionLogger } from './types.js';
import { vi } from 'vitest';

function createLogger(): VisionLogger {
  return vi.fn();
}

describe('AdaptiveFrameSampler', () => {
  let sampler: AdaptiveFrameSampler;

  beforeEach(() => {
    sampler = new AdaptiveFrameSampler(createLogger(), {
      minFps: 1,
      maxFps: 5,
      diffThreshold: 0.05,
      hashSize: 16,
    });
  });

  describe('first frame', () => {
    it('should always emit the first frame', () => {
      const buf = Buffer.from('frame-1');
      const result = sampler.processFrame(buf, 0);
      expect(result).not.toBeNull();
      expect(result!.isKeyFrame).toBe(true);
      expect(result!.frameIndex).toBe(0);
    });
  });

  describe('identical frames', () => {
    it('should skip identical frames within maxFps interval', () => {
      const buf = Buffer.from('identical-frame');
      sampler.processFrame(buf, 0); // first = emit

      // Same buffer, within minFps interval but past maxFps
      const result = sampler.processFrame(buf, 300);
      // 300ms > 200ms (maxFps=5, interval=200ms), identical hash → diff=0
      // But 300ms < 1000ms (minFps=1), so skip by diff threshold
      expect(result).toBeNull();
    });

    it('should emit identical frame when minFps interval exceeded', () => {
      const buf = Buffer.from('identical-frame');
      sampler.processFrame(buf, 0); // first = emit

      // 1100ms > 1000ms (1/minFps), force emit even if identical
      const result = sampler.processFrame(buf, 1100);
      expect(result).not.toBeNull();
    });
  });

  describe('different frames', () => {
    it('should emit when frames differ above threshold', () => {
      const buf1 = Buffer.from('frame-aaa');
      const buf2 = Buffer.from('frame-zzz');
      sampler.processFrame(buf1, 0); // first

      // Different buffer, past maxFps interval
      const result = sampler.processFrame(buf2, 300);
      expect(result).not.toBeNull();
      expect(result!.isKeyFrame).toBe(true);
    });
  });

  describe('maxFps enforcement', () => {
    it('should skip frames within maxFps interval even if different', () => {
      const buf1 = Buffer.from('frame-1');
      const buf2 = Buffer.from('frame-2');
      sampler.processFrame(buf1, 0);

      // 100ms < 200ms (1000/5), should skip
      const result = sampler.processFrame(buf2, 100);
      expect(result).toBeNull();
    });
  });

  describe('stats', () => {
    it('should track sent and skipped frames', () => {
      const buf = Buffer.from('frame');
      sampler.processFrame(buf, 0); // sent
      sampler.processFrame(buf, 100); // skipped (maxFps)
      sampler.processFrame(buf, 300); // skipped (identical, no min fps)

      const stats = sampler.getStats();
      expect(stats.framesSent).toBe(1);
      expect(stats.framesSkipped).toBe(2);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      const buf = Buffer.from('frame');
      sampler.processFrame(buf, 0);

      sampler.reset();
      const stats = sampler.getStats();
      expect(stats.framesSent).toBe(0);
      expect(stats.framesSkipped).toBe(0);
    });

    it('should treat next frame as first after reset', () => {
      const buf = Buffer.from('same-data');
      sampler.processFrame(buf, 0);

      sampler.reset();

      // After reset, same buffer is treated as first frame
      const result = sampler.processFrame(buf, 0);
      expect(result).not.toBeNull();
    });
  });

  describe('frame index', () => {
    it('should increment frame index for each emitted frame', () => {
      const buf1 = Buffer.from('frame-aaa');
      const buf2 = Buffer.from('frame-bbb');
      const buf3 = Buffer.from('frame-ccc');

      const r1 = sampler.processFrame(buf1, 0);
      const r2 = sampler.processFrame(buf2, 300);
      const r3 = sampler.processFrame(buf3, 600);

      expect(r1!.frameIndex).toBe(0);
      expect(r2!.frameIndex).toBe(1);
      expect(r3!.frameIndex).toBe(2);
    });
  });
});
