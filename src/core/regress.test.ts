import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { draft } from './intent.js';
import { listRegressions, recordRegression, regressionProblems } from './regress.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-regress-'));
  draft(root, '# t\n', '- { id: tests, then: "every test passes", check: { type: run, cmd: "true" } }\n');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('regress record — a recorded regression is one that check --all can read', () => {
  it('a long title gives an id within 40 characters, the file is listed, and the next one is numbered r-2', () => {
    const first = recordRegression(root, { scenario: 'tests', title: 'installHookFile kept only the last notify entry per event, so a second PreToolUse matcher dropped the Bash one' });
    expect(first.id.length).toBeLessThanOrEqual(40);
    expect(first.id).toMatch(/^r-1-installhookfile-kept-only-the-[a-z-]*[a-z]$/);
    expect(listRegressions(root).map((s) => s.id)).toEqual([first.id]);
    const second = recordRegression(root, { scenario: 'tests', title: 'another' });
    expect(second.id).toBe('r-2-another');
    expect(listRegressions(root)).toHaveLength(2);
    expect(regressionProblems(root)).toEqual([]);
  });

  it('a regression file that parses to nothing is named in the problems, not dropped silently', () => {
    fs.mkdirSync(path.join(root, '.vibe', 'regressions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.vibe', 'regressions', 'r-1-too-long-an-identifier-for-the-rule-to-accept.yaml'), '- { id: r-1-too-long-an-identifier-for-the-rule-to-accept, then: "x", check: { type: run, cmd: "true" } }\n');
    expect(listRegressions(root)).toEqual([]);
    expect(regressionProblems(root)).toEqual(['regressions/r-1-too-long-an-identifier-for-the-rule-to-accept.yaml is not checked — r-1-too-long-an-identifier-for-the-rule-to-accept: id must be 1-40 chars of lowercase letters, digits, hyphens']);
  });

  it('observe: a source check that mutates cannot become a regression', () => {
    draft(root, '# t\n', '- { id: restore, then: x, check: { type: run, cmd: "npm run db:restore && npm test" } }\n');
    expect(() => recordRegression(root, { scenario: 'restore', title: 'seed overwritten' })).toThrow(/a regression must observe — restore mutates \(restore\)/);
    expect(listRegressions(root)).toEqual([]);
  });
});
