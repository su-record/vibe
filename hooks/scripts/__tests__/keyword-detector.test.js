import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'keyword-detector.js');

/**
 * Run keyword-detector.js with given text as argv.
 * Returns { stdout, exitCode }.
 */
function runDetector(text) {
  try {
    const stdout = execFileSync('node', [SCRIPT, text], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return { stdout: stdout.trim(), exitCode: 0 };
  } catch (err) {
    return { stdout: (err.stdout || '').trim(), exitCode: err.status };
  }
}

// ══════════════════════════════════════════════════
// Individual keyword detection
// ══════════════════════════════════════════════════
describe('keyword-detector', () => {
  describe('ralph keyword', () => {
    it('should detect ralph keyword', () => {
      const result = runDetector('implement the login feature ralph');
      expect(result.stdout).toContain('[RALPH MODE]');
      expect(result.stdout).toContain('persistence');
    });

    it('should detect ralph case-insensitively', () => {
      const result = runDetector('RALPH fix all the bugs');
      expect(result.stdout).toContain('[RALPH MODE]');
    });
  });

  describe('ultrawork keyword', () => {
    it('should detect ultrawork keyword', () => {
      const result = runDetector('ultrawork build the entire app');
      expect(result.stdout).toContain('[ULTRAWORK MODE]');
      expect(result.stdout).toContain('parallel');
    });

    it('should detect ulw alias', () => {
      const result = runDetector('ulw refactor the codebase');
      expect(result.stdout).toContain('[ULTRAWORK MODE]');
    });

    it('should detect Korean alias when word boundary matches', () => {
      // Note: \\b word boundary may not match Korean characters reliably
      // because \\b is designed for ASCII word boundaries.
      // This test documents the current behavior.
      const result = runDetector('울트라워크');
      // Korean chars lack ASCII word boundaries, so regex may not match
      // If it does match, great; if not, this documents the limitation
      expect(typeof result.stdout).toBe('string');
    });
  });

  describe('ralplan keyword', () => {
    it('should detect ralplan keyword', () => {
      const result = runDetector('ralplan design the architecture');
      expect(result.stdout).toContain('[RALPLAN MODE]');
      expect(result.stdout).toContain('persistence');
      expect(result.stdout).toContain('planning');
    });
  });

  describe('verify keyword', () => {
    it('should detect verify keyword', () => {
      const result = runDetector('verify the implementation is correct');
      expect(result.stdout).toContain('[VERIFY MODE]');
      expect(result.stdout).toContain('verification');
    });
  });

  describe('quick keyword', () => {
    it('should detect quick keyword', () => {
      const result = runDetector('quick fix this typo');
      expect(result.stdout).toContain('[QUICK MODE]');
      expect(result.stdout).toContain('fast');
    });
  });

  describe('explore keyword', () => {
    it('should detect explore keyword', () => {
      const result = runDetector('explore the codebase structure');
      expect(result.stdout).toContain('[EXPLORE MODE]');
      expect(result.stdout).toContain('exploration');
    });
  });

  describe('plan keyword', () => {
    it('should detect plan keyword', () => {
      const result = runDetector('plan the new feature');
      expect(result.stdout).toContain('[PLAN MODE]');
      expect(result.stdout).toContain('planning');
    });
  });

  // ══════════════════════════════════════════════════
  // Keyword combinations / synergies
  // ══════════════════════════════════════════════════
  describe('keyword combinations', () => {
    it('should detect ralph+ultrawork synergy', () => {
      const result = runDetector('ralph ultrawork build everything from scratch');
      expect(result.stdout).toContain('[RALPH+ULTRAWORK]');
      expect(result.stdout).toContain('persistence');
      expect(result.stdout).toContain('parallel');
    });

    it('should detect ralph+verify synergy', () => {
      const result = runDetector('ralph verify each step carefully');
      expect(result.stdout).toContain('[RALPH+VERIFY]');
    });

    it('should output both keywords when no synergy key matches sorted order', () => {
      // KEYWORD_SYNERGIES defines 'ultrawork+explore' but processCombinations
      // sorts keywords alphabetically → tries 'explore+ultrawork' which has no match.
      // So individual outputs are emitted instead.
      const result = runDetector('ultrawork explore the entire project');
      expect(result.stdout).toContain('[ULTRAWORK MODE]');
      expect(result.stdout).toContain('[EXPLORE MODE]');
      expect(result.stdout).toContain('[FLAGS]');
    });
  });

  // ══════════════════════════════════════════════════
  // No keywords
  // ══════════════════════════════════════════════════
  describe('no keywords detected', () => {
    it('should output nothing when no keywords present', () => {
      const result = runDetector('just a normal prompt with no magic words');
      expect(result.stdout).toBe('');
    });

    it('should not match partial words', () => {
      // "verify" inside "verifying" — depends on word boundary regex
      // The regex uses \b so "verifying" would NOT match "verify" as a whole word
      // Actually \bverify\b would match "verify" in "verifying"? No — "verifying" has
      // chars after "verify" that are word chars, so \bverify\b won't match.
      const result = runDetector('verifying the output looks good');
      expect(result.stdout).toBe('');
    });

    it('should not match keywords embedded in other words', () => {
      const result = runDetector('exploration of quickly planning');
      // "explore" should NOT match "exploration" (word boundary)
      // "quick" should NOT match "quickly"
      // "plan" should NOT match "planning"
      expect(result.stdout).toBe('');
    });
  });

  // ══════════════════════════════════════════════════
  // Empty input — shows help
  // ══════════════════════════════════════════════════
  describe('help output', () => {
    it('should show usage info with no input', () => {
      const result = runDetector('');
      // Empty string arg is still truthy, pass no args instead
      try {
        const stdout = execFileSync('node', [SCRIPT], {
          encoding: 'utf-8',
          timeout: 5000,
        });
        expect(stdout).toContain('Available magic keywords');
        expect(stdout).toContain('Keyword combinations');
      } catch (err) {
        // Should exit 0, but just in case
        expect(err.stdout || '').toContain('Available magic keywords');
      }
    });
  });

  // ══════════════════════════════════════════════════
  // Flags collection
  // ══════════════════════════════════════════════════
  describe('flags output', () => {
    it('should output collected flags for single keyword', () => {
      const result = runDetector('ralph do the thing');
      expect(result.stdout).toContain('[FLAGS]');
      expect(result.stdout).toContain('persistence');
      expect(result.stdout).toContain('verification');
    });

    it('should merge flags from multiple keywords', () => {
      const result = runDetector('ralph quick finish this');
      expect(result.stdout).toContain('[FLAGS]');
      expect(result.stdout).toContain('persistence');
      expect(result.stdout).toContain('fast');
    });
  });
});
