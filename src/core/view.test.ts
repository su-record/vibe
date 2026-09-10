import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { approve, draft } from './intent.js';
import { answer, ask, resolve } from './inbox.js';
import { readState, writeState } from './state.js';
import { treeHash } from './tree.js';
import { buildStateView } from './view.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-view-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const THREE = '- { id: a, then: x, check: { type: run, cmd: "true" } }\n- { id: b, then: y, check: { type: file, path: out.txt, exists: true } }\n- { id: c, then: z, needs: [a], check: { type: run, cmd: "true" } }\n';

describe('vibe state — the next line is the procedure', () => {
  it('next: names discover, approve, build then check --all, check --all, answer inbox, prove on STUCK and report on DONE; size is small or full', () => {
    expect(buildStateView(root, root).next).toMatch(/^discover/);
    draft(root, '# t\n\n## Why\nx\n', THREE);
    expect(buildStateView(root, root).next).toMatch(/^approve/);
    approve(root, null);
    let v = buildStateView(root, root);
    expect(v.size).toBe('small');
    expect(v.next).toBe('build a, b, c first, then one vibe check --all');
    expect(v.scenarios.map((s) => s.check)).toEqual(['true', 'out.txt', 'true']); // the brief: what each check acts on
    expect(v.scenarios[1]?.files).toBeUndefined(); // out.txt does not exist yet — nothing to name
    fs.writeFileSync(path.join(root, 'out.txt'), 'x');
    expect(buildStateView(root, root).scenarios[1]?.files).toEqual(['out.txt']); // a file the check touches is named, to be read whole
    writeState(root, { ...readState(root), state: 'RUNNING' });
    fs.writeFileSync(path.join(root, '.vibe', 'results.json'), JSON.stringify({ a: { last: 'pass', at: 'now', run: 'r-1', tree: treeHash(root) }, b: { last: 'pass', at: 'now', run: 'r-1', tree: treeHash(root) } }));
    v = buildStateView(root, root);
    expect(v.next).toBe('build c first, then one vibe check --all');
    fs.writeFileSync(path.join(root, '.vibe', 'results.json'), JSON.stringify({ a: { last: 'pass', at: 'now', run: 'r-1', tree: treeHash(root) }, b: { last: 'pass', at: 'now', run: 'r-1', tree: treeHash(root) }, c: { last: 'fail', at: 'now', run: 'r-1' } }));
    expect(buildStateView(root, root).next).toMatch(/^fix c — on a failure, fix what the check names/); // a failed scenario: fix it, files named when there are any
    ask(root, { question: 'which currency?', scenario: 'b' });
    expect(buildStateView(root, root).next).toMatch(/^wait — q-.* asked; the user answers; stop and wait/); // asking is a stop
    fs.writeFileSync(path.join(root, '.vibe', 'inbox.jsonl'), '');
    writeState(root, { ...readState(root), state: 'STUCK', runs: 2 });
    expect(buildStateView(root, root).next).toMatch(/^prove — STUCK/);
    writeState(root, { ...readState(root), state: 'DONE', runs: 3 });
    fs.writeFileSync(path.join(root, '.vibe', 'results.json'), JSON.stringify({ a: { last: 'pass', at: 'now', run: 'r-3', tree: treeHash(root) }, b: { last: 'pass', at: 'now', run: 'r-3', tree: treeHash(root) }, c: { last: 'pass', at: 'now', run: 'r-3', tree: treeHash(root) } }));
    const done = buildStateView(root, root);
    expect(done.next).toBe('report — DONE r-3: answer the user from this output — what was built, which checks passed — reply in chat, not vibe ask; with no skill and no further reads; HANDOFF.md only if the intent asks');
    const reportQuestion = ask(root, { question: 'Which format?' });
    answer(root, reportQuestion.id, 'Plain text');
    expect(buildStateView(root, root).next).toBe(`answered ${reportQuestion.id}: "Plain text" — reply in chat, not vibe ask; vibe inbox resolve <id> once used`);
  });

  it('files: build output is not a file a scenario is about — a check that runs dist/x.js names nothing', () => {
    fs.mkdirSync(path.join(root, 'dist'));
    fs.writeFileSync(path.join(root, 'dist', 'x.js'), '');
    draft(root, '# t\n', '- { id: s, then: w, check: { type: run, cmd: "node dist/x.js src --max-file 400" } }\n');
    expect(buildStateView(root, root).scenarios[0]?.files).toBeUndefined();
  });

  it('human items remain visible but are not gates, even with a failed result', () => {
    draft(root, '# t\n', THREE + '- { id: taste, then: the wording reads well, check: { type: human, question: "Please review the wording" } }\n');
    approve(root, null);
    const failed = { last: 'fail', at: 'now', run: 'r-1', tree: treeHash(root) };
    fs.writeFileSync(path.join(root, '.vibe', 'results.json'), JSON.stringify({ a: failed, taste: failed }));
    const view = buildStateView(root, root);
    expect(view.scenarios.find((s) => s.id === 'taste')).toMatchObject({ type: 'human', last: 'fail' });
    expect(view.remaining).toEqual(['a', 'b', 'c']);
    expect(view.next).toBe('fix a — on a failure, fix what the check names; vibe context <id> when that is not enough; then vibe check <id>');
  });

  it('inbox: an unanswered question makes next a wait; an answered one carries its answer and lets the work continue; STUCK follows the same rule', () => {
    draft(root, '# t\n\n## Why\nx\n', THREE);
    approve(root, null);
    fs.writeFileSync(path.join(root, 'out.txt'), 'x');
    fs.writeFileSync(path.join(root, '.vibe', 'results.json'), JSON.stringify({ a: { last: 'pass', at: 'now', run: 'r-1', tree: treeHash(root) } }));
    const { id } = ask(root, { question: 'which currency?', scenario: 'b' });
    expect(buildStateView(root, root).next).toBe(`wait — ${id} asked; the user answers; stop and wait — do not answer it yourself`);
    answer(root, id, 'KRW');
    const v = buildStateView(root, root);
    expect(v.next).toBe(`answered ${id}: "KRW" — continue building b (files: out.txt), c; then vibe check --all; vibe inbox resolve <id> once used`);
    expect(v.inbox.items[0]?.answer).toBe('KRW');
    writeState(root, { ...readState(root), state: 'STUCK', runs: 2 });
    expect(buildStateView(root, root).next).toBe(`answered ${id}: "KRW" — continue building b (files: out.txt), c; then vibe check --all; vibe inbox resolve <id> once used`);
    resolve(root, id);
    expect(buildStateView(root, root).next).toBe('prove — STUCK: the same failure twice; vibe ask, then stop');
  });

  it('answered discovery and draft questions resume their stage without starting an unapproved build', () => {
    const discovery = ask(root, { question: 'Which problem matters?' });
    answer(root, discovery.id, 'Missed follow-ups');
    const discovered = buildStateView(root, root);
    expect(discovered.stage).toBe('discover');
    expect(discovered.next).toContain('continue discovery with vibe-discover');
    expect(discovered.next).not.toMatch(/building|check --all/);
    resolve(root, discovery.id);
    draft(root, '# t\n', THREE);
    const scope = ask(root, { question: 'Which output is acceptable?' });
    answer(root, scope.id, 'Local drafts for review');
    const scoped = buildStateView(root, root);
    expect(scoped.stage).toBe('scope');
    expect(scoped.next).toContain('continue scope with vibe-scope');
    expect(scoped.next).toContain('request approval');
    expect(scoped.next).not.toMatch(/building|check --all/);
  });

  it('size: a review check, an irreversible scenario, a ninth scenario or a needs chain two deep makes a task full; a fifth does not', () => {
    draft(root, '# t\n', THREE + '- { id: d, then: w, check: { type: review, path: doc.md, lang: en } }\n');
    expect(buildStateView(root, root).size).toBe('full');
    approve(root, null);
    expect(buildStateView(root, root).next).toBe('build a, b, c, d first, then one vibe check --all; on a failure, fix what the check names; vibe context <id> when that is not enough');
    draft(root, '# t\n', THREE + '- { id: d, then: w, needs: [c], check: { type: run, cmd: "true" } }\n');
    expect(buildStateView(root, root).size).toBe('full');
    draft(root, '# t\n', THREE);
    expect(buildStateView(root, root).size).toBe('small');
    // five run/file scenarios are still small — a count is not a reason to load the build skill
    draft(root, '# t\n', THREE + '- { id: d, then: w, check: { type: run, cmd: "true" } }\n- { id: e, then: v, check: { type: run, cmd: "true" } }\n');
    expect(buildStateView(root, root).size).toBe('small');
    // an irreversible scenario is: the skill's authorize procedure applies
    draft(root, '# t\n', THREE + '- { id: d, then: w, irreversible: "push:origin", check: { type: run, cmd: "true" } }\n');
    expect(buildStateView(root, root).size).toBe('full');
    // nine scenarios are: parallel worktrees apply
    draft(root, '# t\n', THREE + Array.from({ length: 6 }, (_, i) => `- { id: s${i}, then: w, check: { type: run, cmd: "true" } }`).join('\n') + '\n');
    expect(buildStateView(root, root).size).toBe('full');
  });
});
