import { describe, it, expect } from 'vitest';
import { ContextCompressor } from './ContextCompressor.js';

describe('ContextCompressor.compress', () => {
  it('returns content unchanged when within token budget (early exit)', () => {
    // 4000 token target = 16,000 chars budget. 10,000 chars is well within it —
    // must NOT be rechunked/compressed (would break KV prefix-cache reuse).
    const content = 'const x = 1;\n'.repeat(770); // ~10,010 chars
    const result = ContextCompressor.compress(content, 4000);

    expect(result.compressed).toBe(content);
    expect(result.compressionRatio).toBe(1);
    expect(result.removedSections).toEqual([]);
  });

  it('compresses content exceeding the char-normalized budget', () => {
    // 25,000 chars ≈ 6,250 tokens > 4,000 target * 1.2 margin → must compress
    const content = 'some explanation text that goes on. '.repeat(700); // ~25,200 chars
    const result = ContextCompressor.compress(content, 4000);

    expect(result.compressedSize).toBeLessThan(result.originalSize);
  });

  it('handles empty context', () => {
    const result = ContextCompressor.compress('', 4000);
    expect(result.compressed).toBe('');
    expect(result.originalSize).toBe(0);
  });
});
