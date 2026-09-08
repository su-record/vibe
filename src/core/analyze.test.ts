import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { analyzeIntent, renderAnalysis } from './analyze.js';
import { draft } from './intent.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-analyze-'));
  fs.mkdirSync(path.join(root, '.vibe'), { recursive: true });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const INTENT = `# Sample project

## Why
Weekly manual work should become automatic.

## What counts as success
- \`vibe map\` builds symbols for every file under src, with signatures and line ranges.
- The settlement report (\`report.xlsx\`) is produced without any manual edits.
- The onboarding docs (\`docs/onboarding.md\`) read clearly to a new engineer.
- Every error message says exactly what went wrong and how to fix it.

## Constraints
- No new dependency should sneak into analyze.ts.
`;

const SCENARIOS = [
  `- { id: map-build, then: "vibe map lists every file's symbols with signatures and line ranges", check: { type: run, cmd: "true" } }`,
  `- { id: report-file, then: "the settlement report report.xlsx is produced without manual edits", check: { type: file, path: report.xlsx, exists: true } }`,
  `- { id: human-review, then: "a human checks the onboarding docs at docs/onboarding.md", check: { type: human, question: "does it read clearly?" } }`,
  `- { id: unrelated, then: "the ledger prunes old research entries after seven days", check: { type: run, cmd: "true" } }`,
].join('\n') + '\n';

describe('analyzeIntent — a read-only consistency check', () => {
  it('marks uncovered, unrequested and weak bullets with a verdict, and touches nothing on disk', () => {
    draft(root, INTENT, SCENARIOS);
    const before = fs.readFileSync(path.join(root, '.vibe', 'scenarios.yaml'), 'utf-8');

    const analysis = analyzeIntent(root);

    expect(analysis.bullets).toHaveLength(4);
    expect(analysis.bullets[0]?.status).toBe('covered');
    expect(analysis.bullets[0]?.scenarios).toContain('map-build');
    expect(analysis.bullets[1]?.status).toBe('covered');
    expect(analysis.bullets[1]?.scenarios).toContain('report-file');
    expect(analysis.bullets[2]?.status).toBe('weak');
    expect(analysis.bullets[2]?.scenarios).toContain('human-review');
    expect(analysis.bullets[3]?.status).toBe('uncovered');
    expect(analysis.bullets[3]?.scenarios).toEqual([]);

    expect(analysis.unrequested).toEqual(['unrelated']);
    expect(analysis.verdict).toEqual({ covered: 2, total: 4, uncovered: 1, unrequested: 1, weak: 1 });

    const rendered = renderAnalysis(analysis);
    expect(rendered).toContain('covered 2/4 · uncovered 1 · unrequested 1 · weak 1');
    expect(rendered).toContain('weak');
    expect(rendered).toContain('uncovered');

    expect(fs.readFileSync(path.join(root, '.vibe', 'scenarios.yaml'), 'utf-8')).toBe(before);
    expect(fs.existsSync(path.join(root, '.vibe', 'knowledge'))).toBe(false);
  });

  it('is empty when there is no "What counts as success" section', () => {
    draft(root, '# t\n\n## Why\nno success section here\n', '- { id: x, then: "x", check: { type: run, cmd: "true" } }\n');
    const analysis = analyzeIntent(root);
    expect(analysis.bullets).toEqual([]);
    expect(analysis.verdict).toEqual({ covered: 0, total: 0, uncovered: 0, unrequested: 1, weak: 0 });
  });
});
