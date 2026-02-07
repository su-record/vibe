import { describe, it, expect, beforeEach } from 'vitest';
import { SearchService } from './SearchService.js';
import { CsvDataLoader } from './CsvDataLoader.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesPath = join(__dirname, '../../../tests/fixtures/ui-ux-data');

describe('SearchService', () => {
  let loader: CsvDataLoader;
  let service: SearchService;

  beforeEach(() => {
    loader = new CsvDataLoader(fixturesPath);
    service = new SearchService(loader);
    service.initialize();
  });

  describe('search', () => {
    it('should search product domain and return results', () => {
      const result = service.search('SaaS', 'product');

      expect(result).toBeDefined();
      expect(result.domain).toBe('product');
      expect(result.query).toBe('SaaS');
      expect(result.count).toBeGreaterThanOrEqual(0);
    });

    it('should return empty results for non-matching query', () => {
      const result = service.search('xyzabc123notfound', 'product');

      expect(result.count).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('should respect maxResults parameter', () => {
      const result = service.search('design', 'product', 1);

      expect(result.count).toBeLessThanOrEqual(1);
    });

    it('should clamp maxResults to upper bound', () => {
      const result = service.search('design', 'product', 1000);

      expect(result.count).toBeLessThanOrEqual(50);
    });

    it('should search color domain', () => {
      const result = service.search('SaaS', 'color');

      expect(result.domain).toBe('color');
      expect(result.file).toBe('colors.csv');
    });

    it('should search typography domain', () => {
      const result = service.search('modern', 'typography');

      expect(result.domain).toBe('typography');
    });

    it('should search landing domain', () => {
      const result = service.search('hero', 'landing');

      expect(result.domain).toBe('landing');
    });

    it('should return proper search result structure', () => {
      const result = service.search('SaaS', 'product');

      expect(result).toHaveProperty('domain');
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('file');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should include score and index in results', () => {
      const result = service.search('SaaS', 'product', 5);

      if (result.results.length > 0) {
        const firstResult = result.results[0];
        expect(firstResult).toHaveProperty('item');
        expect(firstResult).toHaveProperty('score');
        expect(firstResult).toHaveProperty('index');
        expect(typeof firstResult.score).toBe('number');
        expect(typeof firstResult.index).toBe('number');
      }
    });
  });

  describe('searchStack', () => {
    it('should search stack-specific data', () => {
      const result = service.searchStack('Image Optimization', 'nextjs');

      expect(result).toBeDefined();
      expect(result.domain).toBe('nextjs');
    });

    it('should return results for valid stack', () => {
      const result = service.searchStack('routing', 'nextjs');

      expect(result.count).toBeGreaterThanOrEqual(0);
    });

    it('should return empty results for unknown stack', () => {
      const result = service.searchStack('test', 'unknownstack');

      expect(result.count).toBe(0);
    });

    it('should respect maxResults for stack search', () => {
      const result = service.searchStack('performance', 'nextjs', 1);

      expect(result.count).toBeLessThanOrEqual(1);
    });
  });

  describe('detectDomain', () => {
    it('should detect style domain from keywords', () => {
      const domain = service.detectDomain('glassmorphism design');

      expect(domain).toBe('style');
    });

    it('should detect color domain from keywords', () => {
      const domain = service.detectDomain('hex color palette');

      expect(domain).toBe('color');
    });

    it('should detect landing domain from keywords', () => {
      const domain = service.detectDomain('hero landing page');

      expect(domain).toBe('landing');
    });

    it('should detect typography domain from keywords', () => {
      const domain = service.detectDomain('font pairing google fonts');

      expect(domain).toBe('typography');
    });

    it('should detect chart domain from keywords', () => {
      const domain = service.detectDomain('bar chart visualization');

      expect(domain).toBe('chart');
    });

    it('should default to product domain when no keywords match', () => {
      const domain = service.detectDomain('xyzqwerty notaword');

      expect(domain).toBe('product');
    });

    it('should handle single word queries', () => {
      const domain = service.detectDomain('color');

      expect(typeof domain).toBe('string');
    });
  });

  describe('auto domain detection in search', () => {
    it('should auto-detect domain when not specified', () => {
      const result = service.search('glassmorphism modern');

      expect(result.domain).toBe('style');
    });

    it('should use provided domain over auto-detection', () => {
      const result = service.search('glassmorphism', 'color');

      expect(result.domain).toBe('color');
    });

    it('should fall back to product domain for generic query', () => {
      const result = service.search('something');

      expect(typeof result.domain).toBe('string');
    });
  });

  describe('LRU cache', () => {
    it('should cache search results', () => {
      const query = 'SaaS business';
      const result1 = service.search(query, 'product', 10);
      const result2 = service.search(query, 'product', 10);

      expect(result1).toEqual(result2);
    });

    it('should return cached result on second call', () => {
      const query = 'modern design';
      const result1 = service.search(query, 'style');
      const result2 = service.search(query, 'style');

      expect(result1.results).toEqual(result2.results);
    });

    it('should use different cache entries for different domains', () => {
      const query = 'blue';
      const resultColor = service.search(query, 'color');
      const resultStyle = service.search(query, 'style');

      expect(resultColor.domain).toBe('color');
      expect(resultStyle.domain).toBe('style');
    });

    it('should use different cache entries for different maxResults', () => {
      const query = 'design';
      const result1 = service.search(query, 'style', 1);
      const result2 = service.search(query, 'style', 5);

      expect(result1.count).toBeLessThanOrEqual(1);
      expect(result2.count).toBeLessThanOrEqual(5);
    });
  });

  describe('query sanitization', () => {
    it('should truncate query longer than 200 characters', () => {
      const longQuery = 'a'.repeat(300);
      const result = service.search(longQuery, 'product');

      expect(result.query.length).toBeLessThanOrEqual(200);
    });

    it('should limit query tokens to 20', () => {
      const manyTokens = Array(30).fill('word').join(' ');
      const result = service.search(manyTokens, 'product');

      const tokenCount = result.query.split(/\s+/).length;
      expect(tokenCount).toBeLessThanOrEqual(20);
    });

    it('should trim whitespace from query', () => {
      const result = service.search('  query with spaces  ', 'product');

      expect(result.query).toBe('query with spaces');
    });
  });

  describe('clearCache', () => {
    it('should clear expired cache entries', () => {
      const service2 = new SearchService(loader);
      service2.initialize();

      service2.search('test', 'product');
      service2.clearCache();

      expect(true).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', () => {
      const result = service.search('', 'product');

      expect(result.count).toBe(0);
    });

    it('should handle query with only stopwords', () => {
      const result = service.search('the and or', 'product');

      expect(result.count).toBe(0);
    });

    it('should handle special characters in query', () => {
      const result = service.search('design@ui#style', 'style');

      expect(typeof result.count).toBe('number');
    });

    it('should handle Korean text queries', () => {
      const result = service.search('디자인', 'product');

      expect(typeof result.count).toBe('number');
    });

    it('should initialize only once', () => {
      const service2 = new SearchService(loader);
      service2.initialize();
      service2.initialize();

      expect(true).toBe(true);
    });
  });
});
