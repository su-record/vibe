import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  createTempDir,
  cleanupTempDir,
  createTestConfig,
  writeTestConfig,
  createTestSkill,
  parseJsonl,
  measureTime,
} from './index.js';

describe('test-helpers', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) cleanupTempDir(dir);
    dirs.length = 0;
  });

  describe('createTempDir / cleanupTempDir', () => {
    it('should create a unique temporary directory', () => {
      const dir = createTempDir();
      dirs.push(dir);

      expect(existsSync(dir)).toBe(true);
      expect(dir).toContain('vibe-test');
    });

    it('should accept custom prefix', () => {
      const dir = createTempDir('custom-prefix');
      dirs.push(dir);

      expect(dir).toContain('custom-prefix');
    });

    it('should cleanup directory', () => {
      const dir = createTempDir();
      expect(existsSync(dir)).toBe(true);

      cleanupTempDir(dir);
      expect(existsSync(dir)).toBe(false);
    });
  });

  describe('createTestConfig', () => {
    it('should return default config', () => {
      const config = createTestConfig();

      expect(config.stackTypes).toEqual(['typescript-react']);
      expect(config.capabilities).toEqual([]);
      expect(config.projectName).toBe('test-project');
    });

    it('should accept overrides', () => {
      const config = createTestConfig({ stackTypes: ['python-django'], capabilities: ['commerce'] });

      expect(config.stackTypes).toEqual(['python-django']);
      expect(config.capabilities).toEqual(['commerce']);
    });
  });

  describe('writeTestConfig', () => {
    it('should write config file to disk', () => {
      const dir = createTempDir();
      dirs.push(dir);

      const configPath = writeTestConfig(dir, { projectName: 'my-project' });

      expect(existsSync(configPath)).toBe(true);
      const content = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(content.projectName).toBe('my-project');
    });
  });

  describe('createTestSkill', () => {
    it('should create SKILL.md with frontmatter', () => {
      const dir = createTempDir();
      dirs.push(dir);

      const skillPath = createTestSkill(dir, {
        name: 'test-skill',
        description: 'A test skill',
        triggers: ['test', 'demo'],
        priority: 50,
      });

      expect(existsSync(skillPath)).toBe(true);
      const content = readFileSync(skillPath, 'utf-8');
      expect(content).toContain('name: test-skill');
      expect(content).toContain('triggers: [test, demo]');
      expect(content).toContain('priority: 50');
    });
  });

  describe('parseJsonl', () => {
    it('should parse JSONL content', () => {
      const content = '{"a":1}\n{"a":2}\n{"a":3}\n';
      const result = parseJsonl<{ a: number }>(content);

      expect(result).toHaveLength(3);
      expect(result[0].a).toBe(1);
      expect(result[2].a).toBe(3);
    });

    it('should skip empty lines', () => {
      const content = '{"a":1}\n\n{"a":2}\n';
      const result = parseJsonl(content);

      expect(result).toHaveLength(2);
    });
  });

  describe('measureTime', () => {
    it('should measure sync function duration', async () => {
      const { result, durationMs } = await measureTime(() => 42);

      expect(result).toBe(42);
      expect(durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
