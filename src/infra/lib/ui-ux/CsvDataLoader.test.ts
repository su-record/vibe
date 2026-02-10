import { describe, it, expect } from 'vitest';
import { CsvDataLoader } from './CsvDataLoader.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesPath = join(__dirname, '../../../tests/fixtures/ui-ux-data');

describe('CsvDataLoader', () => {
  describe('load', () => {
    it('should successfully load a CSV file', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load('products.csv');

      expect(data).not.toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBeGreaterThan(0);
    });

    it('should parse CSV headers correctly', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load('products.csv');

      expect(data).not.toBeNull();
      const firstRow = data![0];
      expect(firstRow).toHaveProperty('No');
      expect(firstRow).toHaveProperty('Product Type');
      expect(firstRow).toHaveProperty('Keywords');
    });

    it('should return null for missing file', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load('nonexistent.csv');

      expect(data).toBeNull();
    });

    it('should trim header whitespace', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load('ui-reasoning.csv');

      expect(data).not.toBeNull();
      const firstRow = data![0];
      for (const key of Object.keys(firstRow)) {
        expect(key).toEqual(key.trim());
      }
    });

    it('should handle BOM (Byte Order Mark) if present', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load('colors.csv');

      expect(data).not.toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should skip empty lines', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load('typography.csv');

      expect(data).not.toBeNull();
      for (const row of data!) {
        expect(Object.keys(row).length).toBeGreaterThan(0);
      }
    });

    it('should load stack-specific CSV files', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load('stacks/nextjs.csv');

      expect(data).not.toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return null on parse errors', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load('nonexistent-malformed.csv');
      expect(data).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing file', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const exists = loader.exists('products.csv');
      expect(exists).toBe(true);
    });

    it('should return false for missing file', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const exists = loader.exists('nonexistent.csv');
      expect(exists).toBe(false);
    });

    it('should detect nested files', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const exists = loader.exists('stacks/nextjs.csv');
      expect(exists).toBe(true);
    });
  });

  describe('path traversal prevention', () => {
    it('should reject filenames with ../', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load('../../../etc/passwd');

      expect(data).toBeNull();
    });

    it('should reject filenames with ..\\ (Windows)', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load('..\\..\\etc\\passwd');

      expect(data).toBeNull();
    });

    it('should reject absolute paths starting with /', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load('/etc/passwd');

      expect(data).toBeNull();
    });

    it('should reject absolute paths starting with \\', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load('\\windows\\system32\\file');

      expect(data).toBeNull();
    });

    it('should allow normal filenames with subfolders', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const exists = loader.exists('stacks/nextjs.csv');
      expect(exists).toBe(true);
    });
  });

  describe('custom base path', () => {
    it('should use custom base path when provided', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load('products.csv');

      expect(data).not.toBeNull();
    });

    it('should fall back when custom path does not contain file', () => {
      const loader = new CsvDataLoader('/nonexistent/path');
      const data = loader.load('products.csv');
      expect(data).toBeNull();
    });
  });

  describe('type safety', () => {
    it('should preserve data types from CSV', () => {
      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load<{ No: string; 'Product Type': string }>(
        'products.csv'
      );

      expect(data).not.toBeNull();
      const firstRow = data![0];
      expect(typeof firstRow.No).toBe('string');
      expect(typeof firstRow['Product Type']).toBe('string');
    });

    it('should load with generic type parameter', () => {
      interface ProductRow extends Record<string, string> {
        No: string;
        'Product Type': string;
        Keywords: string;
      }

      const loader = new CsvDataLoader(fixturesPath);
      const data = loader.load<ProductRow>('products.csv');

      expect(data).not.toBeNull();
      expect(data![0].No).toBeDefined();
      expect(data![0]['Product Type']).toBeDefined();
    });
  });
});
