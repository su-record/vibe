import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  serializeVector,
  deserializeVector,
} from '../cosine.js';

describe('cosine', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([1, 2, 3]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([0, 1, 0]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([-1, 0, 0]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
    });

    it('should handle high-dimensional vectors', () => {
      const dim = 256;
      const a = new Float32Array(dim);
      const b = new Float32Array(dim);
      for (let i = 0; i < dim; i++) {
        a[i] = Math.random();
        b[i] = a[i]; // identical
      }
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 4);
    });

    it('should return 0 for empty vectors', () => {
      expect(cosineSimilarity(new Float32Array(0), new Float32Array(0))).toBe(0);
    });

    it('should return 0 for mismatched dimensions', () => {
      const a = new Float32Array([1, 2]);
      const b = new Float32Array([1, 2, 3]);
      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it('should return 0 for zero vectors', () => {
      const a = new Float32Array([0, 0, 0]);
      const b = new Float32Array([1, 2, 3]);
      expect(cosineSimilarity(a, b)).toBe(0);
    });
  });

  describe('serialize/deserialize roundtrip', () => {
    it('should perfectly roundtrip a vector', () => {
      const original = [0.1, 0.2, 0.3, -0.5, 1.0];
      const buf = serializeVector(original);
      const restored = deserializeVector(buf);

      expect(restored.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(restored[i]).toBeCloseTo(original[i], 5);
      }
    });

    it('should roundtrip 256-dimension vector', () => {
      const original = Array.from({ length: 256 }, () => Math.random() * 2 - 1);
      const buf = serializeVector(original);
      const restored = deserializeVector(buf);

      expect(restored.length).toBe(256);
      expect(buf.byteLength).toBe(256 * 4); // Float32 = 4 bytes
    });

    it('should produce correct buffer size', () => {
      const vec = [1.0, 2.0, 3.0];
      const buf = serializeVector(vec);
      expect(buf.byteLength).toBe(3 * 4);
    });

    it('should handle empty vector', () => {
      const buf = serializeVector([]);
      const restored = deserializeVector(buf);
      expect(restored.length).toBe(0);
    });
  });
});
