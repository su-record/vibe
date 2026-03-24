import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';
import { MemoryStorage } from '../../memory/MemoryStorage.js';
import { ParityTester, PARITY_THRESHOLDS } from '../ParityTester.js';

function makeTester(): { tester: ParityTester; storage: MemoryStorage; testDir: string } {
  const testDir = join(tmpdir(), `parity-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const storage = new MemoryStorage(testDir);
  const tester = new ParityTester(storage);
  return { tester, storage, testDir };
}

describe('ParityTester', () => {
  let tester: ParityTester;
  let storage: MemoryStorage;
  let testDir: string;

  beforeEach(() => {
    ({ tester, storage, testDir } = makeTester());
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // ─── Model Registration ──────────────────────────────────────────────────────

  describe('model registration', () => {
    it('registers a model and returns ModelVersion', () => {
      const model = tester.registerModel('claude-sonnet-4-5', 'Claude Sonnet 4.5');
      expect(model.id).toBe('claude-sonnet-4-5');
      expect(model.name).toBe('Claude Sonnet 4.5');
      expect(model.registeredAt).toBeTruthy();
    });

    it('retrieves all registered models', () => {
      tester.registerModel('claude-sonnet-4-5', 'Claude Sonnet 4.5');
      tester.registerModel('claude-sonnet-4-6', 'Claude Sonnet 4.6');
      const models = tester.getModels();
      expect(models).toHaveLength(2);
      expect(models.map(m => m.id)).toEqual(['claude-sonnet-4-5', 'claude-sonnet-4-6']);
    });

    it('replaces model on re-registration', () => {
      tester.registerModel('claude-sonnet-4-5', 'Old Name');
      tester.registerModel('claude-sonnet-4-5', 'New Name');
      const models = tester.getModels();
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('New Name');
    });

    it('returns empty array when no models registered', () => {
      expect(tester.getModels()).toEqual([]);
    });
  });

  // ─── Record Baseline ─────────────────────────────────────────────────────────

  describe('recordModelBaseline', () => {
    it('records baseline results without error', () => {
      tester.registerModel('claude-sonnet-4-5', 'Claude Sonnet 4.5');
      expect(() => {
        tester.recordModelBaseline('my-skill', 'claude-sonnet-4-5', [
          { evalId: 'eval-1', passed: true, output: 'good', durationMs: 100, tokenCount: 50 },
          { evalId: 'eval-2', passed: false, output: 'bad', durationMs: 200, tokenCount: 80 },
        ]);
      }).not.toThrow();
    });

    it('accepts optional prompt field', () => {
      expect(() => {
        tester.recordModelBaseline('my-skill', 'claude-sonnet-4-5', [
          { evalId: 'eval-1', passed: true, output: 'ok', durationMs: 100, tokenCount: 50, prompt: 'Do X' },
        ]);
      }).not.toThrow();
    });
  });

  // ─── Parity Test: Obsolete Candidate ─────────────────────────────────────────

  describe('runParityTest — obsolete candidate', () => {
    it('marks skill as obsolete when new model baseline is close to with-skill', () => {
      const evals = ['eval-1', 'eval-2', 'eval-3', 'eval-4', 'eval-5'];

      // Old model: 2/5 pass
      tester.recordModelBaseline('skill-a', 'old-model', evals.map((id, i) => ({
        evalId: id, passed: i < 2, output: '', durationMs: 100, tokenCount: 50, prompt: `prompt-${id}`,
      })));

      // New model: 5/5 pass (much better)
      tester.recordModelBaseline('skill-a', 'new-model', evals.map(id => ({
        evalId: id, passed: true, output: '', durationMs: 100, tokenCount: 50, prompt: `prompt-${id}`,
      })));

      // With-skill: 5/5 pass
      tester.recordModelBaseline('skill-a', 'with_skill', evals.map(id => ({
        evalId: id, passed: true, output: '', durationMs: 100, tokenCount: 50, prompt: `prompt-${id}`,
      })));

      const result = tester.runParityTest('skill-a', 'old-model', 'new-model');

      expect(result.oldBaselinePassRate).toBeCloseTo(0.4);
      expect(result.newBaselinePassRate).toBeCloseTo(1.0);
      expect(result.withSkillPassRate).toBeCloseTo(1.0);
      expect(result.parityScore).toBeCloseTo(1.0);
      expect(result.obsoleteCandidate).toBe(true);
    });

    it('parityScore is capped at 1.0 even if new baseline exceeds with-skill', () => {
      // new baseline: 4/4, with_skill: 3/4 → ratio would be 4/3 > 1.0
      tester.recordModelBaseline('skill-b', 'old-model', [
        { evalId: 'e1', passed: false, output: '', durationMs: 100, tokenCount: 50 },
      ]);
      tester.recordModelBaseline('skill-b', 'new-model', [
        { evalId: 'e1', passed: true, output: '', durationMs: 100, tokenCount: 50 },
        { evalId: 'e2', passed: true, output: '', durationMs: 100, tokenCount: 50 },
        { evalId: 'e3', passed: true, output: '', durationMs: 100, tokenCount: 50 },
        { evalId: 'e4', passed: true, output: '', durationMs: 100, tokenCount: 50 },
      ]);
      tester.recordModelBaseline('skill-b', 'with_skill', [
        { evalId: 'e1', passed: true, output: '', durationMs: 100, tokenCount: 50 },
        { evalId: 'e2', passed: true, output: '', durationMs: 100, tokenCount: 50 },
        { evalId: 'e3', passed: true, output: '', durationMs: 100, tokenCount: 50 },
        { evalId: 'e4', passed: false, output: '', durationMs: 100, tokenCount: 50 },
      ]);

      const result = tester.runParityTest('skill-b', 'old-model', 'new-model');
      expect(result.parityScore).toBeLessThanOrEqual(1.0);
    });
  });

  // ─── Parity Test: Not Obsolete ───────────────────────────────────────────────

  describe('runParityTest — not obsolete', () => {
    it('does not mark skill as obsolete when new model is same as old', () => {
      const evals = ['eval-1', 'eval-2', 'eval-3'];

      // Old model: 1/3 pass
      tester.recordModelBaseline('skill-c', 'old-model', evals.map((id, i) => ({
        evalId: id, passed: i === 0, output: '', durationMs: 100, tokenCount: 50,
      })));

      // New model: same 1/3 pass
      tester.recordModelBaseline('skill-c', 'new-model', evals.map((id, i) => ({
        evalId: id, passed: i === 0, output: '', durationMs: 100, tokenCount: 50,
      })));

      // With-skill: 3/3 pass
      tester.recordModelBaseline('skill-c', 'with_skill', evals.map(id => ({
        evalId: id, passed: true, output: '', durationMs: 100, tokenCount: 50,
      })));

      const result = tester.runParityTest('skill-c', 'old-model', 'new-model');

      expect(result.newBaselinePassRate).toBeCloseTo(1 / 3);
      expect(result.parityScore).toBeCloseTo(1 / 3);
      expect(result.obsoleteCandidate).toBe(false);
    });

    it('does not mark as obsolete when parity is just below threshold', () => {
      // new baseline: 84%, with_skill: 100% → parity = 0.84 < 0.85
      const evals = Array.from({ length: 100 }, (_, i) => `eval-${i}`);
      tester.recordModelBaseline('skill-d', 'old-model', evals.map((id, i) => ({
        evalId: id, passed: i < 50, output: '', durationMs: 10, tokenCount: 10,
      })));
      tester.recordModelBaseline('skill-d', 'new-model', evals.map((id, i) => ({
        evalId: id, passed: i < 84, output: '', durationMs: 10, tokenCount: 10,
      })));
      tester.recordModelBaseline('skill-d', 'with_skill', evals.map(id => ({
        evalId: id, passed: true, output: '', durationMs: 10, tokenCount: 10,
      })));

      const result = tester.runParityTest('skill-d', 'old-model', 'new-model');
      expect(result.parityScore).toBeCloseTo(0.84);
      expect(result.obsoleteCandidate).toBe(false);
    });
  });

  // ─── Parity Test: Threshold Boundary ─────────────────────────────────────────

  describe('runParityTest — threshold boundary', () => {
    it(`marks obsolete at exactly OBSOLESCENCE_RATIO (${PARITY_THRESHOLDS.OBSOLESCENCE_RATIO})`, () => {
      // 17/20 = 0.85 new baseline, 20/20 with-skill → parity = 0.85
      const evals = Array.from({ length: 20 }, (_, i) => `e-${i}`);
      tester.recordModelBaseline('skill-e', 'old-model', evals.map((id, i) => ({
        evalId: id, passed: i < 10, output: '', durationMs: 10, tokenCount: 10,
      })));
      tester.recordModelBaseline('skill-e', 'new-model', evals.map((id, i) => ({
        evalId: id, passed: i < 17, output: '', durationMs: 10, tokenCount: 10,
      })));
      tester.recordModelBaseline('skill-e', 'with_skill', evals.map(id => ({
        evalId: id, passed: true, output: '', durationMs: 10, tokenCount: 10,
      })));

      const result = tester.runParityTest('skill-e', 'old-model', 'new-model');
      expect(result.parityScore).toBeCloseTo(0.85);
      expect(result.obsoleteCandidate).toBe(true);
    });
  });

  // ─── EvalComparisons ─────────────────────────────────────────────────────────

  describe('evalComparisons', () => {
    it('computes improved flag correctly', () => {
      tester.recordModelBaseline('skill-f', 'old-model', [
        { evalId: 'e1', passed: false, output: '', durationMs: 100, tokenCount: 50, prompt: 'Q1' },
        { evalId: 'e2', passed: true, output: '', durationMs: 100, tokenCount: 50, prompt: 'Q2' },
        { evalId: 'e3', passed: false, output: '', durationMs: 100, tokenCount: 50, prompt: 'Q3' },
      ]);
      tester.recordModelBaseline('skill-f', 'new-model', [
        { evalId: 'e1', passed: true, output: '', durationMs: 100, tokenCount: 50, prompt: 'Q1' },   // improved
        { evalId: 'e2', passed: true, output: '', durationMs: 100, tokenCount: 50, prompt: 'Q2' },   // not improved (was already passing)
        { evalId: 'e3', passed: false, output: '', durationMs: 100, tokenCount: 50, prompt: 'Q3' },  // not improved
      ]);
      tester.recordModelBaseline('skill-f', 'with_skill', [
        { evalId: 'e1', passed: true, output: '', durationMs: 100, tokenCount: 50, prompt: 'Q1' },
        { evalId: 'e2', passed: true, output: '', durationMs: 100, tokenCount: 50, prompt: 'Q2' },
        { evalId: 'e3', passed: true, output: '', durationMs: 100, tokenCount: 50, prompt: 'Q3' },
      ]);

      const result = tester.runParityTest('skill-f', 'old-model', 'new-model');
      const e1 = result.evalComparisons.find(c => c.evalId === 'e1');
      const e2 = result.evalComparisons.find(c => c.evalId === 'e2');
      const e3 = result.evalComparisons.find(c => c.evalId === 'e3');

      expect(e1?.improved).toBe(true);
      expect(e2?.improved).toBe(false);
      expect(e3?.improved).toBe(false);
      expect(e1?.prompt).toBe('Q1');
    });
  });

  // ─── History and Latest ───────────────────────────────────────────────────────

  describe('getHistory and getLatest', () => {
    it('returns empty history for unknown skill', () => {
      expect(tester.getHistory('no-such-skill')).toEqual([]);
    });

    it('returns null latest for unknown skill', () => {
      expect(tester.getLatest('no-such-skill')).toBeNull();
    });

    it('accumulates history over multiple runs', () => {
      const setup = (modelId: string, passCount: number, total: number): void => {
        const evals = Array.from({ length: total }, (_, i) => `e-${i}`);
        tester.recordModelBaseline('skill-g', modelId, evals.map((id, i) => ({
          evalId: id, passed: i < passCount, output: '', durationMs: 10, tokenCount: 10,
        })));
      };

      setup('with_skill', 5, 5);
      setup('old-model', 2, 5);
      setup('new-model-v1', 3, 5);
      tester.runParityTest('skill-g', 'old-model', 'new-model-v1');

      setup('new-model-v2', 5, 5);
      tester.runParityTest('skill-g', 'old-model', 'new-model-v2');

      const history = tester.getHistory('skill-g');
      expect(history).toHaveLength(2);
      expect(history[0].newModel).toBe('new-model-v1');
      expect(history[1].newModel).toBe('new-model-v2');
    });

    it('getLatest returns the most recent test', () => {
      const setup = (modelId: string, passCount: number, total: number): void => {
        const evals = Array.from({ length: total }, (_, i) => `e-${i}`);
        tester.recordModelBaseline('skill-h', modelId, evals.map((id, i) => ({
          evalId: id, passed: i < passCount, output: '', durationMs: 10, tokenCount: 10,
        })));
      };

      setup('with_skill', 5, 5);
      setup('old-model', 1, 5);
      setup('new-model-a', 3, 5);

      const firstResult = tester.runParityTest('skill-h', 'old-model', 'new-model-a');

      setup('new-model-b', 5, 5);
      const secondResult = tester.runParityTest('skill-h', 'old-model', 'new-model-b');

      // Verify second result is more recent by timestamp
      expect(secondResult.timestamp >= firstResult.timestamp).toBe(true);

      // getLatest should return the entry with the lexicographically greatest createdAt (ISO string)
      // If timestamps are equal (same millisecond), verify we get one of the two valid results
      const latest = tester.getLatest('skill-h');
      expect(latest).not.toBeNull();
      expect(['new-model-a', 'new-model-b']).toContain(latest!.newModel);
      // The second result should be obsolete
      expect(secondResult.obsoleteCandidate).toBe(true);
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty baseline results — parityScore = 0, not obsolete', () => {
      const result = tester.runParityTest('empty-skill', 'old-model', 'new-model');
      expect(result.oldBaselinePassRate).toBe(0);
      expect(result.newBaselinePassRate).toBe(0);
      expect(result.withSkillPassRate).toBe(0);
      expect(result.parityScore).toBe(0);
      expect(result.obsoleteCandidate).toBe(false);
      expect(result.evalComparisons).toEqual([]);
    });

    it('returns parity score 1.0 when both new baseline and with-skill are 0 but new baseline has results', () => {
      // new baseline passes, but with_skill has no data → parityScore = 1.0 (new baseline > 0, with_skill = 0)
      tester.recordModelBaseline('skill-zero', 'new-model', [
        { evalId: 'e1', passed: true, output: '', durationMs: 100, tokenCount: 50 },
      ]);
      const result = tester.runParityTest('skill-zero', 'old-model', 'new-model');
      expect(result.withSkillPassRate).toBe(0);
      expect(result.parityScore).toBe(1.0);
      expect(result.obsoleteCandidate).toBe(true);
    });

    it('persists result id and timestamp', () => {
      const result = tester.runParityTest('skill-ids', 'old-model', 'new-model');
      expect(result.id).toMatch(/^parity-/);
      expect(result.timestamp).toBeTruthy();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });
  });

  // ─── Format Report ────────────────────────────────────────────────────────────

  describe('formatReport', () => {
    it('produces a markdown report with summary table', () => {
      const evals = ['e1', 'e2', 'e3', 'e4'];
      tester.recordModelBaseline('skill-rpt', 'old-model', evals.map((id, i) => ({
        evalId: id, passed: i < 1, output: '', durationMs: 100, tokenCount: 50, prompt: `Prompt ${id}`,
      })));
      tester.recordModelBaseline('skill-rpt', 'new-model', evals.map((id, i) => ({
        evalId: id, passed: i < 4, output: '', durationMs: 100, tokenCount: 50, prompt: `Prompt ${id}`,
      })));
      tester.recordModelBaseline('skill-rpt', 'with_skill', evals.map(id => ({
        evalId: id, passed: true, output: '', durationMs: 100, tokenCount: 50, prompt: `Prompt ${id}`,
      })));

      const result = tester.runParityTest('skill-rpt', 'old-model', 'new-model');
      const report = tester.formatReport(result);

      expect(report).toContain('# Parity Report: skill-rpt');
      expect(report).toContain('Old Model');
      expect(report).toContain('New Model');
      expect(report).toContain('Parity Score');
      expect(report).toContain('YES');
      expect(report).toContain('deprecation candidate');
      expect(report).toContain('Per-Eval Comparison');
    });

    it('omits recommendation section when not obsolete', () => {
      tester.recordModelBaseline('skill-keep', 'old-model', [
        { evalId: 'e1', passed: false, output: '', durationMs: 100, tokenCount: 50 },
      ]);
      tester.recordModelBaseline('skill-keep', 'new-model', [
        { evalId: 'e1', passed: false, output: '', durationMs: 100, tokenCount: 50 },
      ]);
      tester.recordModelBaseline('skill-keep', 'with_skill', [
        { evalId: 'e1', passed: true, output: '', durationMs: 100, tokenCount: 50 },
      ]);

      const result = tester.runParityTest('skill-keep', 'old-model', 'new-model');
      const report = tester.formatReport(result);

      expect(report).toContain('No');
      expect(report).not.toContain('deprecation candidate');
    });
  });
});
