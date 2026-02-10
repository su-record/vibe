import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DesignSystemGenerator } from './DesignSystemGenerator.js';
import { SearchService } from './SearchService.js';
import { CsvDataLoader } from './CsvDataLoader.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesPath = join(__dirname, '../../../tests/fixtures/ui-ux-data');

const tmpDir = join(__dirname, '../../../tmp');

describe('DesignSystemGenerator', () => {
  let generator: DesignSystemGenerator;
  let searchService: SearchService;
  let loader: CsvDataLoader;

  beforeEach(() => {
    loader = new CsvDataLoader(fixturesPath);
    searchService = new SearchService(loader);
    searchService.initialize();
    generator = new DesignSystemGenerator(searchService);

    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('generate', () => {
    it('should generate design system with all required fields', () => {
      const ds = generator.generate('SaaS business dashboard', 'my-project');

      expect(ds).toBeDefined();
      expect(ds.projectName).toBe('my-project');
      expect(ds).toHaveProperty('category');
      expect(ds).toHaveProperty('stylePriority');
      expect(ds).toHaveProperty('colorMood');
      expect(ds).toHaveProperty('typographyMood');
      expect(ds).toHaveProperty('antiPatterns');
      expect(ds).toHaveProperty('severity');
      expect(ds).toHaveProperty('decisionRules');
      expect(ds).toHaveProperty('colorPalette');
      expect(ds).toHaveProperty('typography');
      expect(ds).toHaveProperty('style');
      expect(ds).toHaveProperty('layout');
      expect(ds).toHaveProperty('cssVariables');
    });

    it('should generate CSS variables', () => {
      const ds = generator.generate('SaaS product', 'test-project');

      expect(ds.cssVariables).toBeDefined();
      expect(typeof ds.cssVariables).toBe('object');
    });

    it('should populate color palette from search results', () => {
      const ds = generator.generate('SaaS blue professional', 'test-project');

      if (ds.colorPalette) {
        expect(ds.colorPalette.primary).toBeDefined();
        expect(ds.colorPalette.secondary).toBeDefined();
        expect(ds.colorPalette.cta).toBeDefined();
        expect(ds.colorPalette.background).toBeDefined();
        expect(ds.colorPalette.text).toBeDefined();
        expect(ds.colorPalette.border).toBeDefined();
      }
    });

    it('should include dashboard layout when available', () => {
      const ds = generator.generate('SaaS dashboard', 'test-project');

      if (ds.dashboardLayout) {
        expect(typeof ds.dashboardLayout).toBe('string');
      }
    });

    it('should parse style priority array', () => {
      const ds = generator.generate('SaaS', 'test-project');

      expect(Array.isArray(ds.stylePriority)).toBe(true);
    });

    it('should parse anti-patterns array', () => {
      const ds = generator.generate('SaaS business', 'test-project');

      expect(Array.isArray(ds.antiPatterns)).toBe(true);
    });

    it('should parse decision rules object', () => {
      const ds = generator.generate('SaaS', 'test-project');

      expect(typeof ds.decisionRules).toBe('object');
    });
  });

  describe('detectCategory', () => {
    it('should detect product category from query', () => {
      const result = generator.detectCategory('SaaS business application');

      expect(result).toHaveProperty('category');
      expect(typeof result.category).toBe('string');
    });

    it('should return default category when no match found', () => {
      const result = generator.detectCategory('xyzabc123notfound');

      expect(result.category).toBeDefined();
    });

    it('should detect dashboard layout', () => {
      const result = generator.detectCategory('SaaS dashboard');

      expect(result).toHaveProperty('dashboardLayout');
    });

    it('should return null for dashboard layout when not available', () => {
      const result = generator.detectCategory('unknown product');

      expect(
        result.dashboardLayout === null || typeof result.dashboardLayout === 'string'
      ).toBe(true);
    });
  });

  describe('validateProjectName', () => {
    it('should accept valid project names', () => {
      const ds1 = generator.generate('SaaS', 'my-project');
      expect(ds1.projectName).toBe('my-project');

      const ds2 = generator.generate('SaaS', 'MyProject123');
      expect(ds2.projectName).toBe('MyProject123');

      const ds3 = generator.generate('SaaS', 'my_project_v2');
      expect(ds3.projectName).toBe('my_project_v2');
    });

    it('should reject invalid project names during persist', () => {
      const ds = generator.generate('SaaS', 'valid-project');

      expect(() => {
        generator.persist(ds, 'invalid project!@#');
      }).toThrow();
    });

    it('should reject Windows reserved names', () => {
      const ds = generator.generate('SaaS', 'valid-project');

      expect(() => {
        generator.persist(ds, 'CON');
      }).toThrow();

      expect(() => {
        generator.persist(ds, 'PRN');
      }).toThrow();

      expect(() => {
        generator.persist(ds, 'LPT1');
      }).toThrow();
    });

    it('should be case-insensitive for reserved names', () => {
      const ds = generator.generate('SaaS', 'valid-project');

      expect(() => {
        generator.persist(ds, 'con');
      }).toThrow();

      expect(() => {
        generator.persist(ds, 'Prn');
      }).toThrow();
    });
  });

  describe('formatMarkdown', () => {
    it('should generate markdown with project name', () => {
      const ds = generator.generate('SaaS', 'MyProject');
      const md = generator.formatMarkdown(ds);

      expect(md).toContain('# MyProject - Design System');
    });

    it('should include CSS Variables section', () => {
      const ds = generator.generate('SaaS', 'test-project');
      const md = generator.formatMarkdown(ds);

      expect(md).toContain('## CSS Variables');
      expect(md).toContain(':root {');
      expect(md).toContain('--color-primary');
    });

    it('should include Color Palette section when available', () => {
      const ds = generator.generate('SaaS color palette', 'test-project');
      const md = generator.formatMarkdown(ds);

      if (ds.colorPalette) {
        expect(md).toContain('## Color Palette');
      }
    });

    it('should include Typography section when available', () => {
      const ds = generator.generate('SaaS typography', 'test-project');
      const md = generator.formatMarkdown(ds);

      if (ds.typography) {
        expect(md).toContain('## Typography');
      }
    });

    it('should include Style section when available', () => {
      const ds = generator.generate('SaaS style', 'test-project');
      const md = generator.formatMarkdown(ds);

      if (ds.style) {
        expect(md).toContain('## Style');
      }
    });

    it('should include Layout section when available', () => {
      const ds = generator.generate('SaaS landing layout', 'test-project');
      const md = generator.formatMarkdown(ds);

      if (ds.layout) {
        expect(md).toContain('## Layout');
      }
    });

    it('should include Dashboard Layout section when available', () => {
      const ds = generator.generate('SaaS dashboard', 'test-project');
      const md = generator.formatMarkdown(ds);

      if (ds.dashboardLayout) {
        expect(md).toContain('## Dashboard Layout');
      }
    });

    it('should include Anti-Patterns section when available', () => {
      const ds = generator.generate('SaaS business', 'test-project');
      const md = generator.formatMarkdown(ds);

      if (ds.antiPatterns.length > 0) {
        expect(md).toContain('## Anti-Patterns');
      }
    });

    it('should include Decision Rules section when available', () => {
      const ds = generator.generate('SaaS', 'test-project');
      const md = generator.formatMarkdown(ds);

      if (Object.keys(ds.decisionRules).length > 0) {
        expect(md).toContain('## Decision Rules');
      }
    });

    it('should include metadata in markdown', () => {
      const ds = generator.generate('SaaS', 'test-project');
      const md = generator.formatMarkdown(ds);

      expect(md).toContain('**Category:**');
      expect(md).toContain('**Severity:**');
      expect(md).toContain('**Color Mood:**');
      expect(md).toContain('**Typography Mood:**');
    });

    it('should format valid CSS in code blocks', () => {
      const ds = generator.generate('SaaS', 'test-project');
      const md = generator.formatMarkdown(ds);

      expect(md).toContain('```css');
      expect(md).toContain('```');
    });

    it('should format valid JSON in code blocks', () => {
      const ds = generator.generate('SaaS business', 'test-project');
      const md = generator.formatMarkdown(ds);

      if (Object.keys(ds.decisionRules).length > 0) {
        expect(md).toContain('```json');
      }
    });
  });

  describe('persist', () => {
    it('should create MASTER.md file', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(tmpDir);

        const ds = generator.generate('SaaS', 'test-project');
        const path = generator.persist(ds, 'test-project');

        expect(path).toContain('MASTER.md');
        expect(existsSync(path)).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should create project directory structure', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(tmpDir);

        const ds = generator.generate('SaaS', 'structure-test');
        const path = generator.persist(ds, 'structure-test');

        expect(path).toContain('structure-test');
        expect(path).toContain('MASTER.md');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should create page-specific override file when page specified', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(tmpDir);

        const ds = generator.generate('SaaS', 'page-test');
        const path = generator.persist(ds, 'page-test', 'landing');

        expect(path).toContain('pages');
        expect(path).toContain('landing.md');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should reject invalid project name during persist', () => {
      const ds = generator.generate('SaaS', 'valid');

      expect(() => {
        generator.persist(ds, 'invalid!@#$');
      }).toThrow();
    });

    it('should reject invalid page name during persist', () => {
      const ds = generator.generate('SaaS', 'valid-project');

      expect(() => {
        generator.persist(ds, 'valid-project', 'invalid!@#');
      }).toThrow();
    });

    it('should write markdown content to file', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(tmpDir);

        const ds = generator.generate('SaaS', 'content-test');
        const persistedPath = generator.persist(ds, 'content-test');

        expect(existsSync(persistedPath)).toBe(true);

        const content = readFileSync(persistedPath, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
        expect(content).toContain('# content-test - Design System');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('CSS color validation', () => {
    it('should validate hex colors in color palette', () => {
      const ds = generator.generate('SaaS blue', 'test-project');

      if (ds.colorPalette) {
        expect(ds.colorPalette.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('should use default color fallbacks for invalid hex', () => {
      const ds = generator.generate('SaaS', 'test-project');

      if (ds.colorPalette) {
        const hexRegex = /^#[0-9A-Fa-f]{6}$/;
        expect(hexRegex.test(ds.colorPalette.primary)).toBe(true);
        expect(hexRegex.test(ds.colorPalette.secondary)).toBe(true);
        expect(hexRegex.test(ds.colorPalette.cta)).toBe(true);
      }
    });

    it('should include color variables in CSS variables', () => {
      const ds = generator.generate('SaaS', 'test-project');

      expect(ds.cssVariables['--color-primary']).toBeDefined();
      expect(ds.cssVariables['--color-secondary']).toBeDefined();
      expect(ds.cssVariables['--color-cta']).toBeDefined();
      expect(ds.cssVariables['--color-background']).toBeDefined();
      expect(ds.cssVariables['--color-text']).toBeDefined();
      expect(ds.cssVariables['--color-border']).toBeDefined();
    });
  });

  describe('CSS variable generation', () => {
    it('should generate font variables', () => {
      const ds = generator.generate('SaaS typography', 'test-project');

      expect(ds.cssVariables['--font-heading']).toBeDefined();
      expect(ds.cssVariables['--font-body']).toBeDefined();
    });

    it('should not contain script injection in CSS values', () => {
      const ds = generator.generate('SaaS', 'test-project');
      const md = generator.formatMarkdown(ds);

      // CSS variable values should not contain script tags or expression()
      expect(md).not.toMatch(/expression\s*\(/i);
      expect(md).not.toMatch(/<script/i);
    });

    it('should parse custom variables from style row', () => {
      const ds = generator.generate('SaaS style', 'test-project');

      expect(typeof ds.cssVariables).toBe('object');
    });
  });

  describe('edge cases', () => {
    it('should handle queries that match no results', () => {
      const ds = generator.generate(
        'xyzabc123notfound',
        'default-test'
      );

      expect(ds).toBeDefined();
      expect(ds.category).toBeDefined();
    });

    it('should handle empty style priority gracefully', () => {
      const ds = generator.generate('SaaS', 'test-project');

      expect(Array.isArray(ds.stylePriority)).toBe(true);
    });

    it('should generate valid markdown even with minimal data', () => {
      const ds = generator.generate('generic', 'minimal-test');
      const md = generator.formatMarkdown(ds);

      expect(md).toContain('# minimal-test - Design System');
      expect(md).toContain('## CSS Variables');
    });

    it('should handle queries with special characters', () => {
      const ds = generator.generate('SaaS@Design#UI', 'special-test');

      expect(ds).toBeDefined();
    });

    it('should handle very long project names (up to 50 chars)', () => {
      const longName = 'a'.repeat(50);
      const ds = generator.generate('SaaS', longName);

      expect(ds.projectName).toBe(longName);
    });

    it('should reject project names longer than 50 characters', () => {
      const ds = generator.generate('SaaS', 'valid');
      const tooLong = 'a'.repeat(51);

      expect(() => {
        generator.persist(ds, tooLong);
      }).toThrow();
    });
  });
});
