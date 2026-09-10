import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateDoneIfEdited, readResults, runChecks } from './check.js';
import { VibeError } from './errors.js';
import { openQuestions } from './inbox.js';
import { approve, draft } from './intent.js';
import { readLedger, record } from './ledger.js';
import { readState, transition } from './state.js';
import { buildStateView } from './view.js';

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

  const failing = (word: string, code: number): string => {
    const file = path.join(root, `${word}.cjs`);
    fs.writeFileSync(file, `process.stdout.write('${word}'); process.exit(${code});`);
    return `node ${word}.cjs`;
  };

  it('a failure keeps exit and output tail and is not DONE', async () => {
    approved(`- { id: bad, then: x, check: { type: run, cmd: "${failing('boom', 3)}" } }`);
    const report = await runChecks(root);
    expect(report.state).toBe('RUNNING');
    expect(report.outcomes[0]).toMatchObject({ id: 'bad', status: 'fail', exit: 3, tail: 'boom' });
    expect(readResults(root)['bad']?.last).toBe('fail');
  });

  it('the same failure twice in a row is STUCK and leaves an inbox question', async () => {
    // the failure's message comes from a data file, so the scenario set never changes behind the approval
    fs.writeFileSync(path.join(root, 'msg.txt'), 'same:1');
    fs.writeFileSync(path.join(root, 'bad.cjs'), "const [m, c] = require('fs').readFileSync('msg.txt', 'utf-8').split(':'); process.stdout.write(m); process.exit(Number(c));");
    approved('- { id: bad, then: x, check: { type: run, cmd: "node bad.cjs" } }');
    await runChecks(root);
    const second = await runChecks(root);
    expect(second.stuck).toBe(true);
    expect(readState(root).state).toBe('STUCK');
    expect(openQuestions(root).some((q) => q.question.startsWith('STUCK'))).toBe(true);
    // a different failure breaks the streak
    fs.writeFileSync(path.join(root, 'msg.txt'), 'other:2');
    const third = await runChecks(root);
    expect(third.stuck).toBe(false);
    expect(readState(root).state).toBe('RUNNING');
  });

  it('stale: a pass is bound to the tree it was taken on — the file changes, the default check selects the scenario again and DONE is withheld', async () => {
    fs.writeFileSync(path.join(root, 'out.txt'), 'good\n');
    approved('- { id: out, then: x, check: { type: file, path: out.txt, contains: good } }');
    expect((await runChecks(root)).done).toBe(true);
    expect(readResults(root)['out']).toMatchObject({ last: 'pass' });
    expect(readResults(root)['out']?.tree).toBeTruthy();
    fs.writeFileSync(path.join(root, 'out.txt'), 'bad\n');
    expect(readResults(root)['out']?.last).toBe('stale');
    const again = await runChecks(root); // default selection, no --all
    expect(again.outcomes.map((o) => [o.id, o.status])).toEqual([['out', 'fail']]);
    expect(again.done).toBe(false);
    expect(readState(root).state).toBe('RUNNING');
  });

  it('files: after a failed check the next line says fix and names the files the scenario is about', async () => {
    fs.writeFileSync(path.join(root, 'out.txt'), 'bad\n');
    approved('- { id: out, then: x, check: { type: file, path: out.txt, contains: good } }');
    const report = await runChecks(root, { all: true });
    expect(report.failed).toBe(1);
    expect(buildStateView(root, root).next).toBe('fix out (files: out.txt) — on a failure, fix what the check names; vibe context <id> when that is not enough; then vibe check <id>');
  });

  it('approval void: scenarios.yaml edited after approval — vibe check refuses (exit 4) and runs nothing', async () => {
    fs.writeFileSync(path.join(root, 'out.txt'), 'bad\n');
    approved('- { id: out, then: x, check: { type: file, path: out.txt, contains: good } }');
    fs.writeFileSync(path.join(root, '.vibe', 'scenarios.yaml'), '- { id: out, then: x, check: { type: file, path: out.txt, exists: true } }\n');
    await expect(runChecks(root, { all: true })).rejects.toThrowError(/approval void/);
    expect(fs.existsSync(path.join(root, '.vibe', 'evidence', 'r-1.json'))).toBe(false);
  });

  it('source-backed checks pass on approved evidence and reject changed evidence before executing', async () => {
    fs.writeFileSync(path.join(root, 'facts.md'), 'observed facts');
    fs.writeFileSync(path.join(root, 'out.txt'), 'local output');
    draft(root, INTENT, '- { id: out, then: x, check: { type: file, path: out.txt, exists: true } }', ['facts.md']);
    approve(root, null);
    expect((await runChecks(root, { all: true })).done).toBe(true);
    fs.writeFileSync(path.join(root, 'facts.md'), 'changed facts');
    expect(invalidateDoneIfEdited(root)).toBe(true);
    await expect(runChecks(root, { all: true })).rejects.toThrow(/approval void.*facts.md.*re-evaluate/);
    expect(readState(root).runs).toBe(1);
    expect(fs.existsSync(path.join(root, '.vibe/evidence/r-2.json'))).toBe(false);
  });

  it('DONE is invalid when source bookkeeping changes even if the working-tree hash is unchanged', async () => {
    fs.writeFileSync(path.join(root, 'facts.md'), 'observed facts');
    draft(root, INTENT, '- { id: facts, then: x, check: { type: file, path: facts.md, exists: true } }', ['facts.md']);
    approve(root, null);
    expect((await runChecks(root)).done).toBe(true);
    fs.rmSync(path.join(root, '.vibe/source-basis.json'));
    expect(invalidateDoneIfEdited(root)).toBe(true);
    await expect(runChecks(root)).rejects.toThrow(/approval void/);
  });

  it('recheck: a parent that passed before and fails on this run blocks its dependent — this run judges, not the last one', async () => {
    fs.writeFileSync(path.join(root, 'out.txt'), 'good\n');
    fs.writeFileSync(path.join(root, 'child.cjs'), "require('fs').appendFileSync('ran.log', 'child\\n');");
    approved([
      '- { id: out, then: x, check: { type: file, path: out.txt, contains: good } }',
      '- { id: child, needs: [out], then: y, check: { type: run, cmd: "node child.cjs" } }',
    ].join('\n'));
    expect((await runChecks(root, { all: true })).done).toBe(true);
    fs.rmSync(path.join(root, 'ran.log'));
    fs.writeFileSync(path.join(root, 'out.txt'), 'bad\n');
    const again = await runChecks(root, { all: true });
    expect(again.outcomes.find((o) => o.id === 'out')?.status).toBe('fail');
    expect(again.outcomes.find((o) => o.id === 'child')).toMatchObject({ status: 'blocked', blockedBy: ['out'] });
    expect(fs.existsSync(path.join(root, 'ran.log'))).toBe(false);
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
    // a's pass was on the previous tree, so it ran again and passed again: both implement the file that changed
    expect(second.map((e) => `${e.from}→${e.to}`).sort()).toEqual(['scenario:a→file:b.txt', 'scenario:b→file:b.txt']);
  });
});

describe('needs — the work graph orders and parallelises checks', () => {
  it('needs: independent scenarios run at the same time; a dependent runs after its parent', async () => {
    fs.writeFileSync(path.join(root, 'peer.cjs'), `
const fs = require('node:fs');
const [own, other] = process.argv.slice(2);
fs.writeFileSync(own + '.started', '');
const deadline = Date.now() + 10000;
const timer = setInterval(() => {
  if (fs.existsSync(other + '.started')) {
    clearInterval(timer);
    fs.writeFileSync(own + '.done', '');
  } else if (Date.now() > deadline) {
    clearInterval(timer);
    process.exitCode = 1;
  }
}, 10);
`);
    fs.writeFileSync(path.join(root, 'child.cjs'), "const fs = require('node:fs'); fs.readFileSync('a.done'); fs.readFileSync('b.done'); fs.writeFileSync('child.done', '');");
    approved(`
- { id: slow-a, then: a overlaps b, check: { type: run, cmd: "node peer.cjs a b" } }
- { id: slow-b, then: b overlaps a, check: { type: run, cmd: "node peer.cjs b a" } }
- { id: child, needs: [slow-a, slow-b], then: both parents finished, check: { type: run, cmd: "node child.cjs" } }
`);
    const report = await runChecks(root, { all: true });
    expect(report.done).toBe(true);
    expect(fs.existsSync(path.join(root, 'child.done'))).toBe(true);
    expect(report.outcomes.map((o) => o.id)).toEqual(['slow-a', 'slow-b', 'child']);
  }, 30_000);

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

  it('mutates: a restoring check is blocked without an authorize record and DONE stays out of reach; it runs after vibe authorize; a reading check runs regardless', async () => {
    fs.writeFileSync(path.join(root, 'probe.cjs'), "require('fs').appendFileSync('ran.log', 'restore\\n');");
    approved([
      '- { id: restore, then: x, check: { type: run, cmd: "node probe.cjs" , timeoutMs: 20000 } }',
      '- { id: read, then: y, check: { type: run, cmd: "node -e 0" } }',
    ].join('\n').replace('cmd: "node probe.cjs"', 'cmd: "node probe.cjs && echo restore"'));
    const first = await runChecks(root);
    const restore = first.outcomes.find((o) => o.id === 'restore')!;
    expect(restore.status).toBe('blocked');
    expect(restore.reason).toContain('irreversible (restore)');
    expect(restore.reason).toContain('vibe authorize --action restore');
    expect(first.outcomes.find((o) => o.id === 'read')?.status).toBe('pass');
    expect(first.state).not.toBe('DONE');
    expect(first.stuck).toBe(false);
    expect(fs.existsSync(path.join(root, 'ran.log'))).toBe(false); // the restore never ran
    record(root, { event: 'authorize', client: 'test', model: null, detail: 'restore: by auto' });
    const second = await runChecks(root);
    expect(second.outcomes.find((o) => o.id === 'restore')?.status).toBe('pass');
    expect(fs.readFileSync(path.join(root, 'ran.log'), 'utf-8')).toBe('restore\n');
    expect(second.state).toBe('DONE');
  });
});
