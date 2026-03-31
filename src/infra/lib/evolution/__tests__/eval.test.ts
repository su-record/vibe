import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';
import { MemoryStorage } from '../../memory/MemoryStorage.js';
import { SkillEvalRunner, EvalAssertion } from '../SkillEvalRunner.js';
import { SkillBenchmark } from '../SkillBenchmark.js';
import { SkillClassifier } from '../SkillClassifier.js';
import { DescriptionOptimizer, TriggerEvalQuery } from '../DescriptionOptimizer.js';

// ─── SkillEvalRunner ─────────────────────────────────────────────────────────

describe('SkillEvalRunner', () => {
  let storage: MemoryStorage;
  let runner: SkillEvalRunner;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `eval-runner-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    runner = new SkillEvalRunner(storage);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('should create eval set and retrieve cases', () => {
    const cases = runner.createEvalSet({
      skillName: 'csv-analyzer',
      evals: [
        {
          prompt: 'Analyze this CSV file and generate a summary',
          expectedOutput: 'A statistical summary of the CSV data',
          files: ['data.csv'],
          assertions: [
            { description: 'Contains row count', type: 'contains', value: 'rows' },
            { description: 'Contains column info', type: 'contains', value: 'columns' },
          ],
        },
        {
          prompt: 'Parse the CSV and find outliers',
          expectedOutput: 'List of outlier values',
        },
      ],
    });

    expect(cases).toHaveLength(2);
    expect(cases[0].skillName).toBe('csv-analyzer');
    expect(cases[0].assertions).toHaveLength(2);
    expect(cases[0].files).toEqual(['data.csv']);
    expect(cases[1].assertions).toHaveLength(0);

    const retrieved = runner.getEvalCases('csv-analyzer');
    expect(retrieved).toHaveLength(2);
  });

  it('should start and complete eval runs', () => {
    const cases = runner.createEvalSet({
      skillName: 'test-skill',
      evals: [{ prompt: 'Test prompt', expectedOutput: 'Expected output' }],
    });

    const runId = runner.startRun(cases[0].id, 'test-skill', 'with_skill');
    expect(runId).toBeTruthy();

    runner.completeRun(runId, 'Generated output with rows and columns', [
      { assertionId: 'a1', description: 'Has content', passed: true, evidence: 'Output is non-empty' },
    ], 1500, 5000);

    const runs = runner.getRunsForEval(cases[0].id);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe('passed');
    expect(runs[0].durationMs).toBe(1500);
    expect(runs[0].tokenCount).toBe(5000);
  });

  it('should mark run as failed when assertions fail', () => {
    const cases = runner.createEvalSet({
      skillName: 'test-skill',
      evals: [{ prompt: 'Test', expectedOutput: 'Expected' }],
    });

    const runId = runner.startRun(cases[0].id, 'test-skill', 'with_skill');
    runner.completeRun(runId, 'Bad output', [
      { assertionId: 'a1', description: 'Has rows', passed: false, evidence: 'Missing' },
      { assertionId: 'a2', description: 'Has cols', passed: true, evidence: 'Present' },
    ], 1000, 3000);

    const runs = runner.getRunsForEval(cases[0].id);
    expect(runs[0].status).toBe('failed');
  });

  it('should handle error runs', () => {
    const cases = runner.createEvalSet({
      skillName: 'test-skill',
      evals: [{ prompt: 'Test', expectedOutput: 'Expected' }],
    });

    const runId = runner.startRun(cases[0].id, 'test-skill', 'baseline');
    runner.failRun(runId, 'Connection timeout');

    const runs = runner.getRunsForEval(cases[0].id);
    expect(runs[0].status).toBe('error');
    expect(runs[0].output).toBe('Connection timeout');
  });

  it('should grade output against assertions', () => {
    const assertions: EvalAssertion[] = [
      { id: 'a1', description: 'Contains summary', type: 'contains', value: 'summary' },
      { id: 'a2', description: 'No errors', type: 'not_contains', value: 'error' },
      { id: 'a3', description: 'Has number', type: 'matches_regex', value: '\\d+' },
      { id: 'a4', description: 'Custom check', type: 'custom', value: 'quality > 8' },
    ];

    const grades = runner.gradeOutput('Here is the summary: 42 items found', assertions);
    expect(grades).toHaveLength(4);
    expect(grades[0].passed).toBe(true);  // contains 'summary'
    expect(grades[1].passed).toBe(true);  // not contains 'error'
    expect(grades[2].passed).toBe(true);  // matches \d+
    expect(grades[3].passed).toBe(false); // custom always false without external grading
  });

  it('should grade failing contains assertion', () => {
    const assertions: EvalAssertion[] = [
      { id: 'a1', description: 'Contains missing word', type: 'contains', value: 'nonexistent' },
    ];
    const grades = runner.gradeOutput('Some output text', assertions);
    expect(grades[0].passed).toBe(false);
    expect(grades[0].evidence).toContain('does not contain');
  });

  it('should grade failing not_contains assertion', () => {
    const assertions: EvalAssertion[] = [
      { id: 'a1', description: 'No errors', type: 'not_contains', value: 'error' },
    ];
    const grades = runner.gradeOutput('An error occurred', assertions);
    expect(grades[0].passed).toBe(false);
    expect(grades[0].evidence).toContain('unexpectedly contains');
  });

  it('should handle invalid regex gracefully', () => {
    const assertions: EvalAssertion[] = [
      { id: 'a1', description: 'Bad regex', type: 'matches_regex', value: '[invalid' },
    ];
    const grades = runner.gradeOutput('test', assertions);
    expect(grades[0].passed).toBe(false);
    expect(grades[0].evidence).toContain('Invalid regex');
  });

  it('should get latest runs grouped by eval and variant', () => {
    const cases = runner.createEvalSet({
      skillName: 'grouped-skill',
      evals: [
        { prompt: 'Eval 1', expectedOutput: 'Expected 1' },
        { prompt: 'Eval 2', expectedOutput: 'Expected 2' },
      ],
    });

    // Run both variants for eval 1
    const wsRun = runner.startRun(cases[0].id, 'grouped-skill', 'with_skill');
    runner.completeRun(wsRun, 'Output ws', [], 100, 500);
    const blRun = runner.startRun(cases[0].id, 'grouped-skill', 'baseline');
    runner.completeRun(blRun, 'Output bl', [], 200, 600);

    // Only with_skill for eval 2
    const wsRun2 = runner.startRun(cases[1].id, 'grouped-skill', 'with_skill');
    runner.completeRun(wsRun2, 'Output ws2', [], 150, 550);

    const grouped = runner.getLatestRuns('grouped-skill');
    expect(grouped.size).toBe(2);

    const eval1 = grouped.get(cases[0].id);
    expect(eval1?.withSkill).not.toBeNull();
    expect(eval1?.baseline).not.toBeNull();

    const eval2 = grouped.get(cases[1].id);
    expect(eval2?.withSkill).not.toBeNull();
    expect(eval2?.baseline).toBeNull();
  });

  it('should delete eval set and associated runs', () => {
    runner.createEvalSet({
      skillName: 'to-delete',
      evals: [{ prompt: 'Test', expectedOutput: 'Expected' }],
    });

    const cases = runner.getEvalCases('to-delete');
    runner.startRun(cases[0].id, 'to-delete', 'with_skill');

    const deleted = runner.deleteEvalSet('to-delete');
    expect(deleted).toBe(1);
    expect(runner.getEvalCases('to-delete')).toHaveLength(0);
  });

  it('should get eval case by ID', () => {
    const cases = runner.createEvalSet({
      skillName: 'by-id-test',
      evals: [{ prompt: 'Specific prompt', expectedOutput: 'Specific output' }],
    });

    const found = runner.getEvalCase(cases[0].id);
    expect(found).not.toBeNull();
    expect(found!.prompt).toBe('Specific prompt');

    const notFound = runner.getEvalCase('nonexistent');
    expect(notFound).toBeNull();
  });
});

// ─── SkillBenchmark ──────────────────────────────────────────────────────────

describe('SkillBenchmark', () => {
  let storage: MemoryStorage;
  let runner: SkillEvalRunner;
  let benchmark: SkillBenchmark;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `eval-bench-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    runner = new SkillEvalRunner(storage);
    benchmark = new SkillBenchmark(storage);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  function setupSkillWithRuns(skillName: string, wsPass: boolean, blPass: boolean): void {
    const cases = runner.createEvalSet({
      skillName,
      evals: [
        { prompt: 'Eval A', expectedOutput: 'Expected A', assertions: [{ description: 'Check A', type: 'contains', value: 'result' }] },
        { prompt: 'Eval B', expectedOutput: 'Expected B', assertions: [{ description: 'Check B', type: 'contains', value: 'data' }] },
      ],
    });

    for (const evalCase of cases) {
      const wsId = runner.startRun(evalCase.id, skillName, 'with_skill');
      const wsOutput = wsPass ? 'Here is the result with data' : 'Incomplete output';
      const wsGrades = runner.gradeOutput(wsOutput, evalCase.assertions);
      runner.completeRun(wsId, wsOutput, wsGrades, 1200, 4500);

      const blId = runner.startRun(evalCase.id, skillName, 'baseline');
      const blOutput = blPass ? 'Here is the result with data' : 'No useful output';
      const blGrades = runner.gradeOutput(blOutput, evalCase.assertions);
      runner.completeRun(blId, blOutput, blGrades, 1500, 5000);
    }
  }

  it('should aggregate benchmark results', () => {
    setupSkillWithRuns('bench-test', true, false);

    const result = benchmark.aggregate('bench-test');
    expect(result.skillName).toBe('bench-test');
    expect(result.iteration).toBe(1);
    expect(result.summary.totalEvals).toBe(2);
    expect(result.summary.withSkill.passRate).toBe(1.0);
    expect(result.summary.baseline.passRate).toBe(0);
    expect(result.summary.delta.passRateDelta).toBe(1.0);
    expect(result.evalBreakdowns).toHaveLength(2);
  });

  it('should track benchmark history across iterations', () => {
    setupSkillWithRuns('history-test', true, false);
    benchmark.aggregate('history-test');

    // Second iteration with improved baseline
    setupSkillWithRuns('history-test', true, true);
    benchmark.aggregate('history-test');

    const history = benchmark.getHistory('history-test');
    expect(history).toHaveLength(2);
    expect(history[0].iteration).toBe(1);
    expect(history[1].iteration).toBe(2);
  });

  it('should get latest benchmark', () => {
    setupSkillWithRuns('latest-test', true, false);
    benchmark.aggregate('latest-test');

    const latest = benchmark.getLatest('latest-test');
    expect(latest).not.toBeNull();
    expect(latest!.iteration).toBe(1);

    const none = benchmark.getLatest('nonexistent');
    expect(none).toBeNull();
  });

  it('should compare two iterations', () => {
    setupSkillWithRuns('compare-test', true, false);
    benchmark.aggregate('compare-test');

    setupSkillWithRuns('compare-test', true, true);
    benchmark.aggregate('compare-test');

    const comparison = benchmark.compare('compare-test', 1, 2);
    expect(comparison.iterationA).not.toBeNull();
    expect(comparison.iterationB).not.toBeNull();
    expect(comparison.improvement).not.toBeNull();
  });

  it('should handle compare with missing iteration', () => {
    const comparison = benchmark.compare('missing', 1, 2);
    expect(comparison.iterationA).toBeNull();
    expect(comparison.iterationB).toBeNull();
    expect(comparison.improvement).toBeNull();
  });

  it('should format benchmark report as markdown', () => {
    setupSkillWithRuns('report-test', true, false);
    const result = benchmark.aggregate('report-test');

    const report = benchmark.formatReport(result);
    expect(report).toContain('# Benchmark: report-test');
    expect(report).toContain('Pass Rate');
    expect(report).toContain('Mean Duration');
    expect(report).toContain('Per-Eval Breakdown');
  });

  it('should compute stddev for duration and tokens', () => {
    const cases = runner.createEvalSet({
      skillName: 'stddev-test',
      evals: [
        { prompt: 'A', expectedOutput: 'A' },
        { prompt: 'B', expectedOutput: 'B' },
        { prompt: 'C', expectedOutput: 'C' },
      ],
    });

    // Varying durations and tokens
    const durations = [1000, 2000, 3000];
    const tokens = [4000, 5000, 6000];
    for (let i = 0; i < cases.length; i++) {
      const wsId = runner.startRun(cases[i].id, 'stddev-test', 'with_skill');
      runner.completeRun(wsId, 'output', [], durations[i], tokens[i]);
      const blId = runner.startRun(cases[i].id, 'stddev-test', 'baseline');
      runner.completeRun(blId, 'output', [], durations[i] + 500, tokens[i] + 500);
    }

    const result = benchmark.aggregate('stddev-test');
    expect(result.summary.withSkill.stddevDurationMs).toBeGreaterThan(0);
    expect(result.summary.withSkill.stddevTokens).toBeGreaterThan(0);
  });
});

// ─── SkillClassifier ─────────────────────────────────────────────────────────

describe('SkillClassifier', () => {
  let storage: MemoryStorage;
  let runner: SkillEvalRunner;
  let benchmarkObj: SkillBenchmark;
  let classifier: SkillClassifier;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `eval-class-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    runner = new SkillEvalRunner(storage);
    benchmarkObj = new SkillBenchmark(storage);
    classifier = new SkillClassifier(storage);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  function createBenchmark(
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

    benchmarkObj.aggregate(skillName);
  }

  it('should classify as unknown when no benchmarks exist', () => {
    const result = classifier.classify('nonexistent');
    expect(result.category).toBe('unknown');
    expect(result.confidence).toBe(0);
    expect(result.trend).toBe('insufficient_data');
  });

  it('should classify as capability_uplift when baseline is high', () => {
    createBenchmark('cap-uplift', 0.9, 0.8);

    const result = classifier.classify('cap-uplift');
    expect(result.category).toBe('capability_uplift');
    expect(result.baselinePassRate).toBeGreaterThanOrEqual(0.7);
  });

  it('should classify as encoded_preference when baseline is low and gap is large', () => {
    createBenchmark('enc-pref', 0.9, 0.1);

    const result = classifier.classify('enc-pref');
    expect(result.category).toBe('encoded_preference');
    expect(result.baselinePassRate).toBeLessThanOrEqual(0.3);
    expect(result.withSkillPassRate).toBeGreaterThan(result.baselinePassRate);
  });

  it('should detect converging trend as capability_uplift', () => {
    // First benchmark: large gap
    createBenchmark('converge', 0.9, 0.2);
    // Second benchmark: gap shrinks
    createBenchmark('converge', 0.9, 0.7);

    const result = classifier.classify('converge');
    expect(result.trend).toBe('converging');
  });

  it('should detect stable trend as encoded_preference', () => {
    // Both benchmarks: consistent gap
    createBenchmark('stable', 0.9, 0.1);
    createBenchmark('stable', 0.9, 0.1);

    const result = classifier.classify('stable');
    expect(result.trend).toBe('stable');
  });

  it('should classify from explicit rates', () => {
    const result = classifier.classifyFromRates('test-skill', 0.95, 0.1);
    expect(result.category).toBe('encoded_preference');
    expect(result.skillName).toBe('test-skill');
  });

  it('should detect becoming obsolete', () => {
    createBenchmark('obsolete', 0.9, 0.85);

    const result = classifier.isBecomingObsolete('obsolete');
    expect(result.obsolete).toBe(true);
    expect(result.reason).toContain('well without the skill');
  });

  it('should not flag non-obsolete skills', () => {
    createBenchmark('healthy', 0.9, 0.1);

    const result = classifier.isBecomingObsolete('healthy');
    expect(result.obsolete).toBe(false);
  });
});

// ─── DescriptionOptimizer ────────────────────────────────────────────────────

describe('DescriptionOptimizer', () => {
  let storage: MemoryStorage;
  let optimizer: DescriptionOptimizer;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `eval-opt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    optimizer = new DescriptionOptimizer(storage);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('should split eval set into train/test with stratification', () => {
    const queries: TriggerEvalQuery[] = [
      { query: 'analyze this csv file', shouldTrigger: true },
      { query: 'parse my spreadsheet data', shouldTrigger: true },
      { query: 'generate a chart from data', shouldTrigger: true },
      { query: 'create csv summary', shouldTrigger: true },
      { query: 'write me an email', shouldTrigger: false },
      { query: 'fix this bug in the auth module', shouldTrigger: false },
      { query: 'deploy the application', shouldTrigger: false },
      { query: 'review my pull request', shouldTrigger: false },
    ];

    const { train, test } = optimizer.splitEvalSet(queries);

    // Both sets should have queries
    expect(train.length).toBeGreaterThan(0);
    expect(test.length).toBeGreaterThan(0);

    // Combined should cover all queries
    expect(train.length + test.length).toBe(queries.length);

    // Both sets should have both types
    expect(train.some(q => q.shouldTrigger)).toBe(true);
    expect(train.some(q => !q.shouldTrigger)).toBe(true);
    expect(test.some(q => q.shouldTrigger)).toBe(true);
    expect(test.some(q => !q.shouldTrigger)).toBe(true);
  });

  it('should evaluate description against trigger queries', () => {
    const description = 'Analyze CSV files, parse spreadsheet data, generate statistical summaries';
    const queries: TriggerEvalQuery[] = [
      { query: 'analyze this csv file and show me stats', shouldTrigger: true },
      { query: 'write a blog post about cooking', shouldTrigger: false },
    ];

    const results = optimizer.evaluateDescription(description, queries);
    expect(results).toHaveLength(2);
    expect(results[0].shouldTrigger).toBe(true);
    expect(results[1].shouldTrigger).toBe(false);
  });

  it('should score results correctly', () => {
    const allCorrect = [
      { query: 'q1', shouldTrigger: true, didTrigger: true, triggerRate: 0.5, correct: true },
      { query: 'q2', shouldTrigger: false, didTrigger: false, triggerRate: 0.0, correct: true },
    ];
    expect(optimizer.scoreResults(allCorrect)).toBe(1.0);

    const halfCorrect = [
      { query: 'q1', shouldTrigger: true, didTrigger: true, triggerRate: 0.5, correct: true },
      { query: 'q2', shouldTrigger: false, didTrigger: true, triggerRate: 0.3, correct: false },
    ];
    expect(optimizer.scoreResults(halfCorrect)).toBe(0.5);

    expect(optimizer.scoreResults([])).toBe(0);
  });

  it('should suggest improvements for false negatives', () => {
    const description = 'Process data files';
    const failedResults = [
      { query: 'analyze csv spreadsheet', shouldTrigger: true, didTrigger: false, triggerRate: 0.05, correct: false },
    ];

    const improved = optimizer.suggestImprovement(description, failedResults);
    expect(improved).not.toBe(description);
    expect(improved.length).toBeGreaterThan(description.length);
  });

  it('should suggest improvements for false positives', () => {
    const description = 'Analyze data and generate reports from spreadsheets';
    const failedResults = [
      { query: 'generate random passwords for security testing', shouldTrigger: false, didTrigger: true, triggerRate: 0.2, correct: false },
    ];

    const improved = optimizer.suggestImprovement(description, failedResults);
    expect(improved).not.toBe(description);
    expect(improved).toContain('Does NOT');
  });

  it('should return original description when no failures', () => {
    const description = 'Perfect description';
    const improved = optimizer.suggestImprovement(description, []);
    expect(improved).toBe(description);
  });

  it('should run full optimization loop', () => {
    const queries: TriggerEvalQuery[] = [
      { query: 'analyze this csv file and create a statistical report', shouldTrigger: true },
      { query: 'parse my data spreadsheet and find patterns', shouldTrigger: true },
      { query: 'summarize the csv columns with averages', shouldTrigger: true },
      { query: 'generate csv from database export', shouldTrigger: true },
      { query: 'help me write a novel', shouldTrigger: false },
      { query: 'fix the authentication bug', shouldTrigger: false },
      { query: 'deploy to production servers', shouldTrigger: false },
      { query: 'review this pull request code', shouldTrigger: false },
    ];

    const result = optimizer.optimize(
      'csv-analyzer',
      'Analyze CSV files',
      queries,
      3
    );

    expect(result.skillName).toBe('csv-analyzer');
    expect(result.originalDescription).toBe('Analyze CSV files');
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.length).toBeLessThanOrEqual(3);

    // Best description should be selected by test score
    expect(result.bestDescription).toBeTruthy();
  });

  it('should persist and retrieve optimization history', () => {
    const queries: TriggerEvalQuery[] = [
      { query: 'analyze csv data', shouldTrigger: true },
      { query: 'write a poem', shouldTrigger: false },
      { query: 'parse spreadsheet', shouldTrigger: true },
      { query: 'cook dinner recipe', shouldTrigger: false },
    ];

    optimizer.optimize('persist-test', 'Initial description', queries, 2);

    const history = optimizer.getHistory('persist-test');
    expect(history).toHaveLength(1);

    const latest = optimizer.getLatest('persist-test');
    expect(latest).not.toBeNull();
    expect(latest!.skillName).toBe('persist-test');
  });

  it('should evaluate candidate on both train and test sets', () => {
    const train: TriggerEvalQuery[] = [
      { query: 'analyze csv file', shouldTrigger: true },
      { query: 'write poetry', shouldTrigger: false },
    ];
    const test: TriggerEvalQuery[] = [
      { query: 'parse data spreadsheet', shouldTrigger: true },
      { query: 'fix security bug', shouldTrigger: false },
    ];

    const candidate = optimizer.evaluateCandidate('Analyze CSV data files', train, test, 1);
    expect(candidate.iteration).toBe(1);
    expect(candidate.trainScore).toBeGreaterThanOrEqual(0);
    expect(candidate.trainScore).toBeLessThanOrEqual(1);
    expect(candidate.testScore).toBeGreaterThanOrEqual(0);
    expect(candidate.testScore).toBeLessThanOrEqual(1);
    expect(candidate.results).toHaveLength(4); // train + test
  });

  it('should generate 20-query trigger eval set', () => {
    const queries = optimizer.generateTriggerEvalSet(
      'csv-analyzer',
      'Analyze CSV files, parse spreadsheet data, generate statistical summaries and charts'
    );

    expect(queries).toHaveLength(20);
    const shouldTrigger = queries.filter(q => q.shouldTrigger);
    const shouldNot = queries.filter(q => !q.shouldTrigger);
    expect(shouldTrigger).toHaveLength(10);
    expect(shouldNot).toHaveLength(10);
  });

  it('should generate near-miss queries from existing skills', () => {
    const existingSkills = new Map([
      ['pdf-processor', 'Process PDF files, extract text and tables from PDF documents'],
      ['email-writer', 'Write professional emails, compose messages, draft correspondence'],
    ]);

    const queries = optimizer.generateTriggerEvalSet(
      'csv-analyzer',
      'Analyze CSV files, parse spreadsheet data, generate statistical summaries',
      existingSkills
    );

    expect(queries).toHaveLength(20);
    // Should have near-miss queries from adjacent skills
    const shouldNot = queries.filter(q => !q.shouldTrigger);
    expect(shouldNot.length).toBe(10);
  });

  it('should validate trigger accuracy', () => {
    const result = optimizer.validateTriggers(
      'csv-analyzer',
      'Analyze CSV files, parse spreadsheet data, generate statistical summaries',
      [
        { query: 'analyze this csv file and show statistics', shouldTrigger: true },
        { query: 'parse my data spreadsheet', shouldTrigger: true },
        { query: 'write a poem about nature', shouldTrigger: false },
        { query: 'deploy to production', shouldTrigger: false },
      ]
    );

    expect(result.accuracy).toBeGreaterThanOrEqual(0);
    expect(result.accuracy).toBeLessThanOrEqual(1);
    expect(result.results).toHaveLength(4);
    expect(Array.isArray(result.falsePositives)).toBe(true);
    expect(Array.isArray(result.falseNegatives)).toBe(true);
  });

  it('should detect trigger collisions between skills', () => {
    const existingSkills = new Map([
      ['data-analyzer', 'Analyze data files, parse CSV and JSON, generate reports'],
      ['email-writer', 'Write professional emails and compose messages'],
      ['pdf-processor', 'Process PDF documents, extract text and tables'],
    ]);

    const collisions = optimizer.checkCollisions(
      'csv-analyzer',
      'Analyze CSV data files, parse spreadsheets, generate statistical reports',
      existingSkills
    );

    // data-analyzer should collide (similar keywords)
    expect(collisions.length).toBeGreaterThanOrEqual(1);
    expect(collisions[0].collidingSkill).toBe('data-analyzer');
    expect(collisions[0].overlapScore).toBeGreaterThan(0);
    expect(collisions[0].sharedKeywords.length).toBeGreaterThan(0);
  });

  it('should batch validate multiple skills', () => {
    const skills = new Map([
      ['csv-analyzer', 'Analyze CSV files, parse spreadsheet data, generate statistical summaries'],
      ['email-writer', 'Write professional emails, compose messages, draft correspondence'],
      ['pdf-processor', 'Process PDF files, extract text and tables from PDF documents'],
    ]);

    const results = optimizer.batchValidate(skills, 0.7);

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.skillName).toBeTruthy();
      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.accuracy).toBeLessThanOrEqual(1);
      expect(typeof result.needsImprovement).toBe('boolean');
    }
    // Results should be sorted by accuracy (ascending)
    for (let i = 1; i < results.length; i++) {
      expect(results[i].accuracy).toBeGreaterThanOrEqual(results[i - 1].accuracy);
    }
  });

  it('should stop optimization early on perfect score', () => {
    // Simple case where description already matches perfectly
    const queries: TriggerEvalQuery[] = [
      { query: 'csv analysis report with statistics', shouldTrigger: true },
      { query: 'completely unrelated cooking recipe topic', shouldTrigger: false },
    ];

    const result = optimizer.optimize(
      'perfect-test',
      'CSV analysis and statistics reporting tool',
      queries,
      5
    );

    // Should stop before max iterations if already perfect
    expect(result.candidates.length).toBeLessThanOrEqual(5);
  });
});
