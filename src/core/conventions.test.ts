import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { conventionsPath, learnConventions, readConventions, updateConventions } from './conventions.js';
import { approve, draft } from './intent.js';
import { record } from './ledger.js';
import { recordRegression } from './regress.js';
import { readText, writeJson } from './store.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-conventions-'));
  fs.mkdirSync(path.join(root, '.vibe'), { recursive: true });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function writeRepoFiles(): void {
  fs.writeFileSync(path.join(root, '.eslintrc.json'), '{}\n');
  fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true } }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }));
}

const REJECT_LINE = 'src/foo.ts:10 | line too long | hurts the reader | shorten it';

function writeCheckWithEvidence(run: string, scenarioId: string): void {
  writeJson(path.join(root, '.vibe', 'evidence', `${run}.json`), { results: [{ id: scenarioId, tail: `REJECT\n${REJECT_LINE}` }] });
  record(root, { event: 'check', client: 'claude-code', model: null, run, scenarios: { [scenarioId]: 'fail' }, passed: 0, failed: 1 });
}

describe('conventions — read + learn, appended once', () => {
  it('reads lint, tsconfig and package.json, learns a recurring REJECT reason and a regression, and a second run appends nothing new', () => {
    writeRepoFiles();
    draft(root, '# t\n', '- { id: tests, then: "every test passes", check: { type: run, cmd: "true" } }\n');
    approve(root, null);
    writeCheckWithEvidence('r-1', 'review-1');
    writeCheckWithEvidence('r-2', 'review-1');
    recordRegression(root, { scenario: 'tests', title: 'a fixed bug' });

    const read = readConventions(root);
    expect(read.some((l) => l.text.includes('lint config present') && l.source === '.eslintrc.json')).toBe(true);
    expect(read.some((l) => l.text.includes('tsconfig strict flags') && l.text.includes('strict'))).toBe(true);
    expect(read.some((l) => l.text.includes('package.json script test'))).toBe(true);

    const learned = learnConventions(root);
    expect(learned.some((l) => l.text.includes('REJECT reason') && l.text.includes(REJECT_LINE))).toBe(true);
    expect(learned.some((l) => l.text.includes('regression: a fixed bug'))).toBe(true);
    expect(learned.some((l) => l.text.startsWith('decided:'))).toBe(true);

    const first = updateConventions(root);
    expect(first.added.length).toBeGreaterThan(0);
    const text = readText(conventionsPath(root)) ?? '';
    expect(text).toContain(REJECT_LINE);
    expect(text).toContain('regression: a fixed bug');

    const second = updateConventions(root);
    expect(second.added).toEqual([]);
    expect(readText(conventionsPath(root))).toBe(text);
  });

  it('a REJECT reason seen only once is not learned as a convention', () => {
    writeCheckWithEvidence('r-1', 'review-1');
    const learned = learnConventions(root);
    expect(learned.some((l) => l.text.includes(REJECT_LINE))).toBe(false);
  });
});
