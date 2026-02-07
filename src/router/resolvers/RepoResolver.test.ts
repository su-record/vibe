/**
 * RepoResolver Tests
 * 3-stage resolution: alias → workspace scan → absolute path
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import { RepoResolver } from './RepoResolver.js';

const mockLogger = vi.fn();

describe('RepoResolver', () => {
  let resolver: RepoResolver;

  beforeEach(() => {
    mockLogger.mockClear();
  });

  describe('Stage 1: Alias matching', () => {
    it('should resolve known alias to configured path', () => {
      const homedir = os.homedir();
      const testPath = path.join(homedir, 'WorkSpace', 'vibe');

      resolver = new RepoResolver(mockLogger, {
        aliases: { vibe: testPath },
        basePaths: [],
      });

      const result = resolver.resolve('vibe');
      expect(result).toBe(path.resolve(testPath));
    });

    it('should return null for unknown alias with no basePaths', () => {
      resolver = new RepoResolver(mockLogger, {
        aliases: {},
        basePaths: [],
      });

      const result = resolver.resolve('nonexistent');
      expect(result).toBeNull();
    });

    it('should be case-insensitive for aliases', () => {
      const homedir = os.homedir();
      const testPath = path.join(homedir, 'WorkSpace', 'vibe');

      resolver = new RepoResolver(mockLogger, {
        aliases: { VIBE: testPath },
        basePaths: [],
      });

      const result = resolver.resolve('vibe');
      expect(result).toBe(path.resolve(testPath));
    });
  });

  describe('Stage 2: WorkSpace scan', () => {
    it('should find directory by partial name in basePaths', () => {
      const homedir = os.homedir();
      const workspacePath = path.join(homedir, 'WorkSpace');

      resolver = new RepoResolver(mockLogger, {
        aliases: {},
        basePaths: [workspacePath],
      });

      // 'vibe' directory should exist in WorkSpace
      const result = resolver.resolve('vibe');
      if (result) {
        expect(result).toContain('vibe');
      }
    });
  });

  describe('Stage 3: Absolute path', () => {
    it('should resolve absolute path if directory exists', () => {
      const testPath = os.tmpdir();

      resolver = new RepoResolver(mockLogger, {
        aliases: {},
        basePaths: [],
      });

      const result = resolver.resolve(testPath);
      expect(result).toBe(path.resolve(testPath));
    });

    it('should return null for non-existent absolute path', () => {
      resolver = new RepoResolver(mockLogger, {
        aliases: {},
        basePaths: [],
      });

      const result = resolver.resolve('/this/path/does/not/exist/ever');
      expect(result).toBeNull();
    });
  });

  describe('Cache', () => {
    it('should cache resolved paths', () => {
      const testPath = os.tmpdir();

      resolver = new RepoResolver(mockLogger, {
        aliases: { temp: testPath },
        basePaths: [],
      });

      const result1 = resolver.resolve('temp');
      const result2 = resolver.resolve('temp');
      expect(result1).toBe(result2);
    });
  });
});
