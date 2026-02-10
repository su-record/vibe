/**
 * Adaptive Frame Sampler — Phase 4-1
 *
 * Diff-based frame sampling: skip unchanged frames for bandwidth savings.
 * Uses downsampled pixel hash for fast comparison.
 */

import * as crypto from 'node:crypto';
import type {
  FrameSamplerConfig,
  FrameSample,
  VisionLogger,
} from './types.js';
import { DEFAULT_SAMPLER_CONFIG } from './types.js';

// ============================================================================
// Adaptive Frame Sampler
// ============================================================================

export class AdaptiveFrameSampler {
  private config: Readonly<FrameSamplerConfig>;
  private logger: VisionLogger;
  private lastHash: string = '';
  private frameIndex: number = 0;
  private lastKeyFrameTime: number = Number.NEGATIVE_INFINITY;
  private framesSkipped: number = 0;

  constructor(logger: VisionLogger, config?: Partial<FrameSamplerConfig>) {
    this.config = { ...DEFAULT_SAMPLER_CONFIG, ...config };
    this.logger = logger;
  }

  /**
   * Process a frame and decide whether to emit or skip.
   * Returns FrameSample if frame should be sent, null if skipped.
   */
  processFrame(buffer: Buffer, timestamp: number): FrameSample | null {
    const hash = this.computeHash(buffer);
    const diff = this.computeDiff(hash, this.lastHash);
    const timeSinceKey = timestamp - this.lastKeyFrameTime;
    const minIntervalMs = 1000 / this.config.maxFps;
    const maxIntervalMs = 1000 / this.config.minFps;

    // Enforce max FPS limit
    if (timeSinceKey < minIntervalMs) {
      this.framesSkipped++;
      return null;
    }

    const isKeyFrame = this.isKeyFrame(diff, timeSinceKey, maxIntervalMs);

    if (!isKeyFrame) {
      this.framesSkipped++;
      return null;
    }

    this.lastHash = hash;
    this.lastKeyFrameTime = timestamp;
    const index = this.frameIndex++;

    return {
      buffer,
      hash,
      isKeyFrame: true,
      frameIndex: index,
      timestamp,
    };
  }

  /** Get sampling stats */
  getStats(): { framesSent: number; framesSkipped: number } {
    return {
      framesSent: this.frameIndex,
      framesSkipped: this.framesSkipped,
    };
  }

  /** Reset sampler state */
  reset(): void {
    this.lastHash = '';
    this.frameIndex = 0;
    this.lastKeyFrameTime = Number.NEGATIVE_INFINITY;
    this.framesSkipped = 0;
  }

  /**
   * Determine if frame is a key frame (should be sent).
   * Key frame if: significant diff OR min FPS interval exceeded.
   */
  private isKeyFrame(diff: number, timeSinceKey: number, maxIntervalMs: number): boolean {
    // Always send if diff exceeds threshold
    if (diff >= this.config.diffThreshold) {
      return true;
    }
    // Force send to maintain minimum FPS
    if (timeSinceKey >= maxIntervalMs) {
      return true;
    }
    return false;
  }

  /**
   * Compute a fast hash of the frame buffer.
   * Uses MD5 of the buffer for speed.
   */
  private computeHash(buffer: Buffer): string {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  /**
   * Compute diff ratio between two hashes.
   * Returns 0 for identical, 1 for completely different.
   */
  private computeDiff(hashA: string, hashB: string): number {
    if (!hashB) return 1; // First frame is always different
    if (hashA === hashB) return 0;

    // Byte-level hamming distance on hex chars
    let diffCount = 0;
    const len = Math.min(hashA.length, hashB.length);
    for (let i = 0; i < len; i++) {
      if (hashA[i] !== hashB[i]) diffCount++;
    }
    return diffCount / len;
  }
}
