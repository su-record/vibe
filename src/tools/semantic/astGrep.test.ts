import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { astGrepSearch, astGrepReplace } from './astGrep.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ast-grep tools', () => {
  const testDir = path.join(os.tmpdir(), 'ast-grep-test-' + Date.now());

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(path.join(testDir, 'test.ts'), `
      console.log("hello");
      console.log("world");
      function greet(name: string) {
        console.log(\`Hello, \${name}\`);
      }
    `);
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('astGrepSearch', () => {
    it('should find console.log patterns', async () => {
      const result = await astGrepSearch({
        pattern: 'console.log($MSG)',
        path: testDir,
      });

      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text as string;
      expect(text).toContain('Found');
      expect(text).toContain('matches');
    });

    it('should find function patterns', async () => {
      const result = await astGrepSearch({
        pattern: 'function $NAME($$$) { $$$ }',
        path: testDir,
      });

      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text as string;
      expect(text).toContain('Found');
    });

    it('should return no matches for non-existent pattern', async () => {
      const result = await astGrepSearch({
        pattern: 'nonExistentFunction()',
        path: testDir,
      });

      const text = result.content[0].text as string;
      expect(text).toContain('No matches');
    });
  });

  describe('astGrepReplace', () => {
    it('should preview replacements in dry run mode', async () => {
      const result = await astGrepReplace({
        pattern: 'console.log($MSG)',
        replacement: 'logger.info($MSG)',
        path: testDir,
        dryRun: true,
      });

      const text = result.content[0].text as string;
      expect(text).toContain('[DRY RUN]');
      expect(text).toContain('replacements');
      expect(text).toContain('console.log');
      expect(text).toContain('logger.info');
    });
  });
});
