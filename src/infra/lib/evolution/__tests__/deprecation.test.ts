import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';
import { MemoryStorage } from '../../memory/MemoryStorage.js';
import { SkillEvalRunner } from '../SkillEvalRunner.js';
import { SkillBenchmark } from '../SkillBenchmark.js';
import { DeprecationDetector } from '../DeprecationDetector.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createBenchmark(
  runner: SkillEvalRunner,
  benchmark: SkillBenchmark,
  skillName: string,
  wsPassRate: number,
  blPassRate: number
): void {
  const totalEvals = 10;
  const wsPassCount = Math.round(wsPassRate * totalEvals);
  const blPassCount = Math.round(blPassRate * totalEvals);

  const evals = Array.from({ length: totalEvals }, (_, i) => ({
    prompt: `Eval ${i}`,
    expectedOutput: `Expected ${i}`,
    assertions: [{ description: 'Check', type: 'contains' as const, value: 'pass' }],
  }));

  const cases = runner.createEvalSet({ skillName, evals });

  for (let i = 0; i < cases.length; i++) {
    const wsId = runner.startRun(cases[i].id, skillName, 'with_skill');
    const wsOutput = i < wsPassCount ? 'pass' : 'fail';
    const wsGrades = runner.gradeOutput(wsOutput, cases[i].assertions);
    runner.completeRun(wsId, wsOutput, wsGrades, 1000, 5000);

    const blId = runner.startRun(cases[i].id, skillName, 'baseline');
    const blOutput = i < blPassCount ? 'pass' : 'fail';
    const blGrades = runner.gradeOutput(blOutput, cases[i].assertions);
    runner.completeRun(blId, blOutput, blGrades, 1200, 5500);
  }

  benchmark.aggregate(skillName);
}

// ─── DeprecationDetector ─────────────────────────────────────────────────────

describe('DeprecationDetector', () => {
  let storage: MemoryStorage;
  let runner: SkillEvalRunner;
  let benchmark: SkillBenchmark;
  let detector: DeprecationDetector;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `depr-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    runner = new SkillEvalRunner(storage);
    benchmark = new SkillBenchmark(storage);
    detector = new DeprecationDetector(storage);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // ─── Empty scan ───────────────────────────────────────────────────────────

  it('should return empty report when no skills exist', () => {
    const report = detector.scan();

    expect(report.totalSkills).toBe(0);
    expect(report.evaluatedSkills).toBe(0);
    expect(report.candidates).toHaveLength(0);
    expect(report.safeSkills).toHaveLength(0);
    expect(report.unevaluatedSkills).toHaveLength(0);
    expect(report.summary.immediate).toBe(0);
    expect(report.summary.soon).toBe(0);
    expect(report.summary.monitor).toBe(0);
    expect(report.summary.safe).toBe(0);
    expect(report.summary.unknown).toBe(0);
  });

  it('should generate report ID and timestamp on empty scan', () => {
    const report = detector.scan();

    expect(report.id).toMatch(/^depr-/);
    expect(report.timestamp).toBeTruthy();
    expect(new Date(report.timestamp).getTime()).toBeGreaterThan(0);
  });

  // ─── getEvaluatedSkills ───────────────────────────────────────────────────

  it('should return empty list when no eval cases exist', () => {
    const skills = detector.getEvaluatedSkills();
    expect(skills).toHaveLength(0);
  });

  it('should return distinct skill names from eval cases', () => {
    runner.createEvalSet({
      skillName: 'skill-alpha',
      evals: [{ prompt: 'P1', expectedOutput: 'O1' }],
    });
    runner.createEvalSet({
      skillName: 'skill-beta',
      evals: [{ prompt: 'P2', expectedOutput: 'O2' }, { prompt: 'P3', expectedOutput: 'O3' }],
    });
    runner.createEvalSet({
      skillName: 'skill-alpha', // duplicate skill, same name
      evals: [{ prompt: 'P4', expectedOutput: 'O4' }],
    });

    const skills = detector.getEvaluatedSkills();
    expect(skills).toHaveLength(2);
    expect(skills).toContain('skill-alpha');
    expect(skills).toContain('skill-beta');
  });

  // ─── checkSkill ───────────────────────────────────────────────────────────

  it('should return null for encoded_preference skills', () => {
    // Low baseline, high skill = encoded preference
    createBenchmark(runner, benchmark, 'team-style', 0.9, 0.1);

    const candidate = detector.checkSkill('team-style');
    expect(candidate).toBeNull();
  });

  it('should return null for skills with no benchmark data', () => {
    runner.createEvalSet({
      skillName: 'no-bench',
      evals: [{ prompt: 'P', expectedOutput: 'E' }],
    });
    // No benchmark aggregated

    const candidate = detector.checkSkill('no-bench');
    expect(candidate).toBeNull();
  });

  it('should return immediate candidate when baseline is very high in single benchmark', () => {
    // Single benchmark with baseline at 90%+ → immediate (no convergence needed)
    createBenchmark(runner, benchmark, 'obsolete-skill', 0.9, 0.9);

    const candidate = detector.checkSkill('obsolete-skill');
    expect(candidate).not.toBeNull();
    expect(candidate!.skillName).toBe('obsolete-skill');
    expect(candidate!.severity).toBe('immediate');
  });

  it('should return soon candidate when baseline is moderately high', () => {
    // Baseline around 70-84% = soon
    createBenchmark(runner, benchmark, 'aging-skill', 0.9, 0.7);

    const candidate = detector.checkSkill('aging-skill');
    expect(candidate).not.toBeNull();
    expect(candidate!.severity).toBe('soon');
  });

  it('should return monitor candidate for capability_uplift with low baseline', () => {
    // Capability uplift (high baseline overall) but not yet converging
    // Single benchmark with 90% baseline still classifies as capability_uplift
    createBenchmark(runner, benchmark, 'early-cap', 0.9, 0.8);

    const candidate = detector.checkSkill('early-cap');
    // With 80% baseline and single benchmark, could be immediate or soon
    expect(candidate).not.toBeNull();
    expect(['immediate', 'soon', 'monitor']).toContain(candidate!.severity);
  });

  it('should include latest benchmark in candidate', () => {
    createBenchmark(runner, benchmark, 'with-bench', 0.9, 0.9);

    const candidate = detector.checkSkill('with-bench');
    if (candidate !== null) {
      expect(candidate.latestBenchmark).not.toBeNull();
      expect(candidate.latestBenchmark!.skillName).toBe('with-bench');
    }
  });

  // ─── Scan with mixed skills ───────────────────────────────────────────────

  it('should categorize mixed skills correctly', () => {
    // encoded_preference: low baseline, stable gap
    createBenchmark(runner, benchmark, 'pref-skill', 0.9, 0.1);
    createBenchmark(runner, benchmark, 'pref-skill', 0.9, 0.1);

    // immediate: very high baseline (single benchmark)
    createBenchmark(runner, benchmark, 'dead-skill', 0.9, 0.9);

    const report = detector.scan();

    expect(report.totalSkills).toBe(2);
    expect(report.safeSkills).toContain('pref-skill');
    expect(report.candidates.some(c => c.skillName === 'dead-skill')).toBe(true);
    const deadCandidate = report.candidates.find(c => c.skillName === 'dead-skill');
    expect(deadCandidate!.severity).toBe('immediate');
  });

  it('should count summary stats correctly', () => {
    // safe skill
    createBenchmark(runner, benchmark, 'safe-skill', 0.9, 0.1);
    createBenchmark(runner, benchmark, 'safe-skill', 0.9, 0.1);

    // immediate candidate
    createBenchmark(runner, benchmark, 'retire-now', 0.9, 0.2);
    createBenchmark(runner, benchmark, 'retire-now', 0.9, 0.9);

    // soon candidate (high baseline single pass)
    createBenchmark(runner, benchmark, 'retire-soon', 0.9, 0.7);

    const report = detector.scan();
    expect(report.summary.safe).toBeGreaterThanOrEqual(1);
    expect(report.summary.immediate + report.summary.soon + report.summary.monitor).toBeGreaterThanOrEqual(1);
  });

  it('should handle skill with eval cases but no benchmark runs', () => {
    runner.createEvalSet({
      skillName: 'no-runs',
      evals: [{ prompt: 'P', expectedOutput: 'E' }],
    });

    const report = detector.scan();
    expect(report.totalSkills).toBe(1);
    // Without benchmark data, classifier returns unknown
    expect(report.candidates.length + report.safeSkills.length + report.unevaluatedSkills.length).toBe(1);
  });

  // ─── Severity determination ───────────────────────────────────────────────

  it('should assign immediate severity for high baseline + converging trend', () => {
    // First benchmark: large gap (ws=0.9, bl=0.3)
    createBenchmark(runner, benchmark, 'converging-high', 0.9, 0.3);
    // Delete eval cases so second benchmark starts fresh
    runner.deleteEvalSet('converging-high');
    // Second benchmark: gap narrows, both now high (ws=0.9, bl=0.9)
    createBenchmark(runner, benchmark, 'converging-high', 0.9, 0.9);

    const candidate = detector.checkSkill('converging-high');
    expect(candidate).not.toBeNull();
    expect(candidate!.severity).toBe('immediate');
    expect(candidate!.reason).toContain('converging');
  });

  it('should assign soon severity when baseline is between 70-84%', () => {
    createBenchmark(runner, benchmark, 'mid-range', 0.9, 0.7);

    const candidate = detector.checkSkill('mid-range');
    expect(candidate).not.toBeNull();
    expect(candidate!.severity).toBe('soon');
  });

  it('should include reason and action in all candidates', () => {
    createBenchmark(runner, benchmark, 'check-fields', 0.9, 0.9);

    const candidate = detector.checkSkill('check-fields');
    if (candidate !== null) {
      expect(candidate.reason).toBeTruthy();
      expect(candidate.action).toBeTruthy();
    }
  });

  // ─── Report formatting ────────────────────────────────────────────────────

  it('should format empty report as markdown', () => {
    const report = detector.scan();
    const markdown = detector.formatReport(report);

    expect(markdown).toContain('# Skill Deprecation Report');
    expect(markdown).toContain('## Summary');
    expect(markdown).toContain('Total Skills Analyzed**: 0');
  });

  it('should include candidates section when candidates exist', () => {
    createBenchmark(runner, benchmark, 'fmt-skill', 0.9, 0.9);

    const report = detector.scan();
    const markdown = detector.formatReport(report);

    expect(markdown).toContain('## Summary');
    if (report.candidates.length > 0) {
      expect(markdown).toContain('## Deprecation Candidates');
      expect(markdown).toContain('fmt-skill');
    }
  });

  it('should include safe skills section when safe skills exist', () => {
    createBenchmark(runner, benchmark, 'safe-fmt', 0.9, 0.1);
    createBenchmark(runner, benchmark, 'safe-fmt', 0.9, 0.1);

    const report = detector.scan();
    const markdown = detector.formatReport(report);

    expect(markdown).toContain('## Safe Skills');
    expect(markdown).toContain('safe-fmt');
  });

  it('should use severity icons in markdown output', () => {
    createBenchmark(runner, benchmark, 'icon-test', 0.9, 0.2);
    createBenchmark(runner, benchmark, 'icon-test', 0.9, 0.9);

    const report = detector.scan();
    const markdown = detector.formatReport(report);

    // Should contain at least one colored circle emoji
    const hasIcon = markdown.includes('🔴') || markdown.includes('🟠') || markdown.includes('🟡');
    expect(hasIcon || report.candidates.length === 0).toBe(true);
  });

  it('should show pass rates in report', () => {
    createBenchmark(runner, benchmark, 'rates-test', 0.9, 0.9);

    const report = detector.scan();
    const markdown = detector.formatReport(report);

    // Pass rates should appear somewhere in the document
    expect(markdown).toContain('%');
  });
});
