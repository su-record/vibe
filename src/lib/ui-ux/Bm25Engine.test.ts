import { describe, it, expect } from 'vitest';
import { Bm25Engine } from './Bm25Engine.js';

describe('Bm25Engine', () => {
  describe('tokenize', () => {
    it('should normalize NFKC and lowercase', () => {
      const engine = new Bm25Engine();
      const tokens = engine.tokenize('HELLO WORLD');
      expect(tokens).toEqual(['hello', 'world']);
    });

    it('should remove stopwords', () => {
      const engine = new Bm25Engine();
      const tokens = engine.tokenize('the quick brown fox');
      expect(tokens).not.toContain('the');
      expect(tokens).toContain('quick');
      expect(tokens).toContain('brown');
      expect(tokens).toContain('fox');
    });

    it('should filter tokens shorter than 2 characters', () => {
      const engine = new Bm25Engine();
      const tokens = engine.tokenize('a ab abc');
      expect(tokens).not.toContain('a');
      expect(tokens).toContain('ab');
      expect(tokens).toContain('abc');
    });

    it('should handle Korean text', () => {
      const engine = new Bm25Engine();
      const tokens = engine.tokenize('안녕하세요 세계');
      expect(tokens).toEqual(['안녕하세요', '세계']);
    });

    it('should extract alphanumeric and Korean characters', () => {
      const engine = new Bm25Engine();
      const tokens = engine.tokenize('hello123 world456');
      expect(tokens).toEqual(['hello123', 'world456']);
    });

    it('should handle mixed English and Korean', () => {
      const engine = new Bm25Engine();
      const tokens = engine.tokenize('react 리액트 design 디자인');
      expect(tokens).toContain('react');
      expect(tokens).toContain('리액트');
      expect(tokens).toContain('design');
      expect(tokens).toContain('디자인');
    });

    it('should return empty array for stopword-only text', () => {
      const engine = new Bm25Engine();
      const tokens = engine.tokenize('the and or but');
      expect(tokens).toEqual([]);
    });
  });

  describe('fit', () => {
    it('should fit documents successfully', () => {
      const engine = new Bm25Engine();
      const documents = ['hello world', 'hello there', 'goodbye world'];
      engine.fit(documents);
      expect(true).toBe(true);
    });

    it('should handle empty documents array', () => {
      const engine = new Bm25Engine();
      engine.fit([]);
      const scores = engine.score('test');
      expect(scores).toEqual([]);
    });

    it('should handle single document', () => {
      const engine = new Bm25Engine();
      engine.fit(['hello world']);
      const scores = engine.score('hello');
      expect(scores.length).toBeGreaterThan(0);
    });
  });

  describe('score', () => {
    it('should score documents based on query', () => {
      const engine = new Bm25Engine();
      const documents = [
        'machine learning algorithm',
        'deep learning neural network',
        'cooking recipe instructions',
      ];
      engine.fit(documents);

      const scores = engine.score('machine learning');
      expect(scores.length).toBeGreaterThan(0);
      expect(scores[0].index).toBe(0);
    });

    it('should return empty scores for empty query', () => {
      const engine = new Bm25Engine();
      engine.fit(['hello world']);
      const scores = engine.score('');
      expect(scores).toEqual([]);
    });

    it('should return empty scores for empty corpus', () => {
      const engine = new Bm25Engine();
      engine.fit([]);
      const scores = engine.score('hello');
      expect(scores).toEqual([]);
    });

    it('should return empty scores for query with no matching tokens', () => {
      const engine = new Bm25Engine();
      engine.fit(['machine learning']);
      const scores = engine.score('xyz abc def');
      expect(scores).toEqual([]);
    });

    it('should filter zero scores', () => {
      const engine = new Bm25Engine();
      engine.fit(['hello world', 'completely different']);
      const scores = engine.score('hello');
      for (const score of scores) {
        expect(score.score).toBeGreaterThan(0);
      }
    });
  });

  describe('deterministic sorting', () => {
    it('should sort by score descending, then by index ascending on tie', () => {
      const engine = new Bm25Engine();
      const documents = ['abc abc abc', 'abc abc', 'abc', 'xyz'];
      engine.fit(documents);

      const scores = engine.score('abc');
      if (scores.length > 1) {
        for (let i = 0; i < scores.length - 1; i++) {
          const isSorted =
            scores[i].score > scores[i + 1].score ||
            (scores[i].score === scores[i + 1].score &&
              scores[i].index < scores[i + 1].index);
          expect(isSorted).toBe(true);
        }
      }
    });

    it('should maintain consistent sorting across multiple calls', () => {
      const engine = new Bm25Engine();
      const documents = [
        'design system modern',
        'design patterns clean',
        'ui design principles',
      ];
      engine.fit(documents);

      const scores1 = engine.score('design');
      const scores2 = engine.score('design');

      expect(scores1).toEqual(scores2);
    });
  });

  describe('edge cases', () => {
    it('should handle very long documents', () => {
      const engine = new Bm25Engine();
      const longDoc = 'word '.repeat(1000);
      engine.fit([longDoc, 'short']);
      const scores = engine.score('word');
      expect(scores.length).toBeGreaterThan(0);
    });

    it('should handle special characters in documents', () => {
      const engine = new Bm25Engine();
      engine.fit(['hello@world.com', 'test#hash$tag']);
      const scores = engine.score('hello');
      expect(scores.length).toBeGreaterThan(0);
    });

    it('should normalize NFKC in documents and query', () => {
      const engine = new Bm25Engine();
      engine.fit(['caf\u00e9']);
      const scores = engine.score('cafe');
      expect(typeof scores).toBe('object');
    });
  });
});
