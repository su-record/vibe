/**
 * VADProcessor Tests
 *
 * Energy-based voice activity detection.
 * Uses synthetic PCM data for testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VADProcessor } from './VADProcessor.js';
import type { VADEvent, VoiceLogger } from './types.js';

function createLogger(): VoiceLogger {
  return vi.fn();
}

/** PCM 16-bit silence frame (all zeros) */
function silenceFrame(samples: number = 320): Buffer {
  return Buffer.alloc(samples * 2, 0);
}

/** PCM 16-bit loud frame (high energy) */
function loudFrame(samples: number = 320, amplitude: number = 16000): Buffer {
  const buf = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const value = Math.round(amplitude * Math.sin((2 * Math.PI * i) / 40));
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, value)), i * 2);
  }
  return buf;
}

describe('VADProcessor', () => {
  let vad: VADProcessor;
  let logger: VoiceLogger;
  let events: VADEvent[];

  beforeEach(() => {
    vi.useFakeTimers();
    logger = createLogger();
    vad = new VADProcessor(logger, {
      silenceThresholdMs: 300,
      minSpeechMs: 100,
      energyThreshold: 0.02,
    });
    events = [];
    vad.on('vad', (event: VADEvent) => {
      events.push(event);
    });
  });

  afterEach(() => {
    vad.reset();
    vi.useRealTimers();
  });

  describe('speech detection', () => {
    it('should detect speech_start on loud audio', () => {
      vad.processFrame(loudFrame());
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('speech_start');
    });

    it('should not detect speech on silence', () => {
      vad.processFrame(silenceFrame());
      expect(events).toHaveLength(0);
    });

    it('should track speaking state', () => {
      expect(vad.speaking).toBe(false);
      vad.processFrame(loudFrame());
      expect(vad.speaking).toBe(true);
    });

    it('should emit speech_end after silence threshold', () => {
      vad.processFrame(loudFrame());
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('speech_start');

      // Advance time so durationMs > minSpeechMs (100)
      vi.advanceTimersByTime(200);

      // Feed silence frame
      vad.processFrame(silenceFrame());

      // Advance past silence threshold (300ms)
      vi.advanceTimersByTime(350);

      expect(events).toHaveLength(2);
      expect(events[1].type).toBe('speech_end');
      expect(events[1].audioData).toBeDefined();
      expect(events[1].durationMs).toBeDefined();
    });

    it('should not emit speech_end if speech resumes before threshold', () => {
      vad.processFrame(loudFrame());
      vad.processFrame(silenceFrame());
      vi.advanceTimersByTime(200); // < 300ms threshold
      vad.processFrame(loudFrame()); // resume speech

      // Advance past original threshold
      vi.advanceTimersByTime(200);

      // Should only have speech_start, no speech_end
      const speechEnds = events.filter(e => e.type === 'speech_end');
      expect(speechEnds).toHaveLength(0);
    });

    it('should continue accumulating audio during speech', () => {
      vad.processFrame(loudFrame(320));
      vi.advanceTimersByTime(50);
      vad.processFrame(loudFrame(320));
      vi.advanceTimersByTime(50);
      vad.processFrame(loudFrame(320));
      vi.advanceTimersByTime(50);

      // Now advance past minSpeechMs total (100ms) before silence
      vad.processFrame(silenceFrame());

      vi.advanceTimersByTime(350);

      const endEvent = events.find(e => e.type === 'speech_end');
      expect(endEvent).toBeDefined();
      // 3 loud + 1 silence = 4 frames in buffer
      expect(endEvent!.audioData!.length).toBe(320 * 2 * 4);
    });
  });

  describe('min speech length', () => {
    it('should ignore very short speech', () => {
      // Simulate very brief loud burst
      const shortVad = new VADProcessor(logger, {
        silenceThresholdMs: 50,
        minSpeechMs: 500,
        energyThreshold: 0.02,
      });
      const shortEvents: VADEvent[] = [];
      shortVad.on('vad', (e: VADEvent) => shortEvents.push(e));

      shortVad.processFrame(loudFrame());
      shortVad.processFrame(silenceFrame());
      vi.advanceTimersByTime(60);

      // speech_start should fire, but speech_end should not (too short)
      const endEvents = shortEvents.filter(e => e.type === 'speech_end');
      expect(endEvents).toHaveLength(0);

      shortVad.reset();
    });
  });

  describe('reset', () => {
    it('should reset speaking state', () => {
      vad.processFrame(loudFrame());
      expect(vad.speaking).toBe(true);

      vad.reset();
      expect(vad.speaking).toBe(false);
    });

    it('should not emit events after reset', () => {
      vad.processFrame(loudFrame());
      const countBefore = events.length;

      vad.reset();
      vi.advanceTimersByTime(1000);

      // No new events should be emitted
      expect(events.length).toBe(countBefore);
    });
  });

  describe('energy calculation', () => {
    it('should return 0 for empty buffer', () => {
      vad.processFrame(Buffer.alloc(0));
      expect(events).toHaveLength(0);
    });

    it('should return 0 for single-byte buffer', () => {
      vad.processFrame(Buffer.alloc(1));
      expect(events).toHaveLength(0);
    });

    it('should detect high energy in loud audio', () => {
      vad.processFrame(loudFrame(320, 30000));
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('speech_start');
    });

    it('should not detect low energy audio', () => {
      // Very low amplitude
      vad.processFrame(loudFrame(320, 50));
      expect(events).toHaveLength(0);
    });
  });
});
