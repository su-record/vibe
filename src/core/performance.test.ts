import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { performanceReport, summarizeRuns } from './performance.js';
import { cmdPerformance } from '../cli/performance.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-perf-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

it('summarizes actual executions without counting blocked work or claiming repeats are waste', () => {
  const result = summarizeRuns([
    { results: [{ id: 'test', status: 'pass', ms: 12, capture: { stdout: { bytes: 30 } } }, { id: 'child', status: 'blocked', ms: 0 }] },
    { results: [{ id: 'test', status: 'fail', ms: 8, capture: { stderr: { bytes: 10 } } }] }, null,
  ]);
  expect(result.checks).toEqual([{ id: 'test', executions: 2, passed: 1, totalMs: 20, outputBytes: 40 }]);
  expect(result.skipped).toBe(1);
  expect(result.limits).toContain('not model tokens');
});

it('does not initialize state, accepts only fixed measurement operations and leaves evidence unchanged', () => {
  expect(performanceReport(root).runs).toBe(0);
  expect(fs.readdirSync(root)).toEqual([]);
  expect(() => cmdPerformance(root, ['startup', 'npm publish'])).toThrow('internal performance');
  expect(() => cmdPerformance(root, ['shell'])).toThrow('internal performance');
  const dir = path.join(root, '.vibe', 'evidence');
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 1; i <= 21; i++) fs.writeFileSync(path.join(dir, `r-${i}.json`), JSON.stringify({ results: [{ id: 'a', status: 'pass', ms: i }] }));
  const before = fs.readFileSync(path.join(dir, 'r-21.json'), 'utf8');
  expect(performanceReport(root)).toMatchObject({ runs: 20, omitted: 1, checks: [{ executions: 20, totalMs: 230 }] });
  expect(fs.readFileSync(path.join(dir, 'r-21.json'), 'utf8')).toBe(before);
});

it('reports malformed, oversized and linked evidence as skipped', () => {
  const dir = path.join(root, '.vibe', 'evidence');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'r-1.json'), 'broken');
  fs.writeFileSync(path.join(dir, 'r-2.json'), 'x'.repeat(1_048_577));
  fs.symlinkSync(path.join(dir, 'r-1.json'), path.join(dir, 'r-3.json'));
  expect(performanceReport(root)).toMatchObject({ runs: 3, skipped: 3, checks: [] });
});
