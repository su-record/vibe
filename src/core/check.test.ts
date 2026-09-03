import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateDoneIfEdited, readResults, runChecks } from './check.js';
import { VibeError } from './errors.js';
import { openQuestions } from './inbox.js';
import { approve, draft } from './intent.js';
import { readLedger } from './ledger.js';
import { readState, transition } from './state.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-check-'));
  fs.mkdirSync(path.join(root, '.vibe'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const INTENT = '# Test intent\n\n## Why\nchecks\n';

function approved(scenarios: string): void {
  const result = draft(root, INTENT, scenarios);
  if (!result.ok) throw new Error(JSON.stringify(result.rejections));
  approve(root, result.token);
}

describe('check — the only verdict path', () => {
  it('does not run before approval (exit 4)', async () => {
    draft(root, INTENT, `- { id: a, then: x, check: { type: run, cmd: "exit 0" } }`);
    await expect(runChecks(root)).rejects.toThrowError(VibeError);
  });

  it('runs run·file checks itself and writes evidence — all pass means DONE', async () => {
    fs.writeFileSync(path.join(root, 'out.txt'), 'total=42\n');
    approved(`
- { id: ok, then: exit 0, check: { type: run, cmd: "exit 0" } }
- { id: out, then: out.txt has a total, check: { type: file, path: out.txt, pattern: "^total=\\\\d+$" } }
`);
    const report = await runChecks(root);
    expect(report.state).toBe('DONE');
    expect(report.done).toBe(true);
    expect(report.passed).toBe(2);
    const evidence = JSON.parse(fs.readFileSync(path.join(root, '.vibe', 'evidence', 'r-1.json'), 'utf-8'));
    expect(evidence.results.map((r: { id: string; status: string }) => [r.id, r.status])).toEqual([['ok', 'pass'], ['out', 'pass']]);
    expect(readLedger(root).map((e) => e.event)).toEqual(['draft', 'approve', 'check', 'done']);
  });

  it('DONE cannot be made without check — a forged state file is void once the tree differs', async () => {
    approved(`- { id: ok, then: x, check: { type: run, cmd: "exit 0" } }`);
    // Suppose the model forged the results and declared DONE by hand
    transition(root, 'RUNNING');
    transition(root, 'DONE', { doneTree: 'forged', doneAt: new Date().toISOString() });
    expect(invalidateDoneIfEdited(root)).toBe(true);
    expect(readState(root).state).toBe('RUNNING');
  });

  it('a failure keeps exit and output tail and is not DONE', async () => {
    approved(`- { id: bad, then: x, check: { type: run, cmd: "echo boom; exit 3" } }`);
    const report = await runChecks(root);
    expect(report.state).toBe('RUNNING');
    expect(report.outcomes[0]).toMatchObject({ id: 'bad', status: 'fail', exit: 3, tail: 'boom' });
    expect(readResults(root)['bad']?.last).toBe('fail');
  });

  it('the same failure twice in a row is STUCK and leaves an inbox question', async () => {
    approved(`- { id: bad, then: x, check: { type: run, cmd: "echo same; exit 1" } }`);
    await runChecks(root);
    const second = await runChecks(root);
    expect(second.stuck).toBe(true);
    expect(readState(root).state).toBe('STUCK');
    expect(openQuestions(root).some((q) => q.question.startsWith('STUCK'))).toBe(true);
    // a different failure breaks the streak
    fs.writeFileSync(path.join(root, '.vibe', 'scenarios.yaml'), `- { id: bad, then: x, check: { type: run, cmd: "echo other; exit 2" } }\n`);
    const third = await runChecks(root);
    expect(third.stuck).toBe(false);
    expect(readState(root).state).toBe('RUNNING');
  });

  it('human scenarios are not gates — they ask once in the inbox and do not block DONE', async () => {
    approved(`
- { id: ok, then: x, check: { type: run, cmd: "exit 0" } }
- { id: taste, then: the wording reads well, check: { type: human, question: "Please review the wording" } }
`);
    const report = await runChecks(root, { all: true });
    expect(report.done).toBe(true);
    expect(report.pending).toBe(1);
    expect(openQuestions(root).map((q) => q.scenario)).toEqual(['taste']);
    await runChecks(root, { all: true });
    expect(openQuestions(root)).toHaveLength(1);
  });

  it('editing after DONE goes back to RUNNING', async () => {
    approved(`- { id: ok, then: x, check: { type: run, cmd: "exit 0" } }`);
    await runChecks(root);
    expect(readState(root).state).toBe('DONE');
    expect(invalidateDoneIfEdited(root)).toBe(false);
    fs.writeFileSync(path.join(root, 'new-file.txt'), 'edit\n');
    expect(invalidateDoneIfEdited(root)).toBe(true);
    expect(readState(root).state).toBe('RUNNING');
  });

  it('by default selects only scenarios that have not passed yet', async () => {
    approved(`
- { id: a, then: x, check: { type: run, cmd: "exit 0" } }
- { id: b, then: y, check: { type: run, cmd: "exit 1" } }
`);
    await runChecks(root);
    const second = await runChecks(root);
    expect(second.outcomes.map((o) => o.id)).toEqual(['b']);
  });
});

describe('tree hash — content, not commit id', () => {
  it('committing the same content keeps DONE; changing content voids it', async () => {
    const git = (...args: string[]): void => void execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    git('init', '-q');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init');
    fs.writeFileSync(path.join(root, 'a.txt'), 'x');
    approved(`- { id: a, then: x, check: { type: file, path: a.txt, contains: x } }`);
    expect((await runChecks(root, { all: true })).done).toBe(true);
    git('add', '-A');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'work');
    expect(invalidateDoneIfEdited(root)).toBe(false);
    expect(readState(root).state).toBe('DONE');
    fs.writeFileSync(path.join(root, 'a.txt'), 'xy');
    expect(invalidateDoneIfEdited(root)).toBe(true);
  });
});

describe('implements edges — files changed since the previous check', () => {
  it('implements: the first check covers every dirty file; the next check only what changed in between', async () => {
    const git = (...args: string[]): void => void execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    git('init', '-q');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init');
    fs.writeFileSync(path.join(root, 'a.txt'), 'a');
    fs.writeFileSync(path.join(root, 'b.txt'), 'b');
    approved(`
- { id: a, then: x, check: { type: file, path: a.txt, contains: a } }
- { id: b, then: x, check: { type: file, path: b.txt, contains: bb } }
`);
    await runChecks(root, { all: true });
    const first = readLedger(root).filter((e) => e.event === 'check').at(-1)?.edges ?? [];
    expect(first.map((e) => `${e.from}→${e.to}`).sort()).toEqual(['scenario:a→file:a.txt', 'scenario:a→file:b.txt']);
    fs.writeFileSync(path.join(root, 'b.txt'), 'bb');
    await runChecks(root);
    const second = readLedger(root).filter((e) => e.event === 'check').at(-1)?.edges ?? [];
    expect(second.map((e) => `${e.from}→${e.to}`)).toEqual(['scenario:b→file:b.txt']);
  });
});

describe('needs — the work graph orders and parallelises checks', () => {
  it('needs: independent scenarios run at the same time; a dependent runs after its parent', async () => {
    approved(`
- { id: slow-a, then: x, check: { type: run, cmd: "sleep 0.6" } }
- { id: slow-b, then: x, check: { type: run, cmd: "sleep 0.6" } }
- { id: child, needs: [slow-a, slow-b], then: x, check: { type: run, cmd: "sleep 0.1" } }
`);
    const started = Date.now();
    const report = await runChecks(root, { all: true });
    const wall = Date.now() - started;
    expect(report.done).toBe(true);
    expect(wall).toBeLessThan(1100); // two 0.6s checks in parallel, then the child — not 1.3s in a row
    expect(report.outcomes.map((o) => o.id)).toEqual(['slow-a', 'slow-b', 'child']);
  });

  it('needs: a dependent of a failed parent is blocked, not run, and DONE is withheld', async () => {
    approved(`
- { id: parent, then: x, check: { type: run, cmd: "exit 1" } }
- { id: child, needs: [parent], then: x, check: { type: run, cmd: "echo ran > child.txt" } }
`);
    const report = await runChecks(root, { all: true });
    expect(report.done).toBe(false);
    expect(report.outcomes.find((o) => o.id === 'child')).toMatchObject({ status: 'blocked', blockedBy: ['parent'], reason: 'blocked — needs parent' });
    expect(fs.existsSync(path.join(root, 'child.txt'))).toBe(false);
    expect(readResults(root)['child']?.last).toBe('blocked');
    expect(report.remaining).toEqual(['parent', 'child']);
    expect(report.failHash).not.toBeNull(); // only the real failure counts toward STUCK
  });

  it('needs: checking one id pulls in ancestors that have not passed', async () => {
    approved(`
- { id: build, then: x, check: { type: run, cmd: "echo built > built.txt" } }
- { id: tests, needs: [build], then: x, check: { type: file, path: built.txt, contains: built } }
`);
    const report = await runChecks(root, { ids: ['tests'] });
    expect(report.outcomes.map((o) => [o.id, o.status])).toEqual([['build', 'pass'], ['tests', 'pass']]);
    const again = await runChecks(root, { ids: ['tests'] });
    expect(again.outcomes.map((o) => o.id)).toEqual(['tests']); // build already passed — not rerun
  });
});
