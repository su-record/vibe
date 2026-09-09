import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { approve, draft } from './intent.js';
import { ask } from './inbox.js';
import { readState, writeState } from './state.js';
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
    expect(v.next).toBe('build a, b, c — then one vibe check --all');
    writeState(root, { ...readState(root), state: 'RUNNING' });
    fs.writeFileSync(path.join(root, '.vibe', 'results.json'), JSON.stringify({ a: { last: 'pass', at: 'now', run: 'r-1' }, b: { last: 'pass', at: 'now', run: 'r-1' } }));
    v = buildStateView(root, root);
    expect(v.next).toBe('build c — then one vibe check --all');
    fs.writeFileSync(path.join(root, '.vibe', 'results.json'), JSON.stringify({ a: { last: 'pass', at: 'now', run: 'r-1' }, b: { last: 'pass', at: 'now', run: 'r-1' }, c: { last: 'fail', at: 'now', run: 'r-1' } }));
    expect(buildStateView(root, root).next).toMatch(/^build c/);
    ask(root, { question: 'which currency?', scenario: 'b' });
    expect(buildStateView(root, root).next).toMatch(/^answer inbox \[q-/);
    fs.writeFileSync(path.join(root, '.vibe', 'inbox.jsonl'), '');
    writeState(root, { ...readState(root), state: 'STUCK', runs: 2 });
    expect(buildStateView(root, root).next).toMatch(/^prove — STUCK/);
    writeState(root, { ...readState(root), state: 'DONE', runs: 3 });
    fs.writeFileSync(path.join(root, '.vibe', 'results.json'), JSON.stringify({ a: { last: 'pass', at: 'now', run: 'r-3' }, b: { last: 'pass', at: 'now', run: 'r-3' }, c: { last: 'pass', at: 'now', run: 'r-3' } }));
    const done = buildStateView(root, root);
    expect(done.next).toBe('report — DONE r-3; say what was built and which checks passed; write HANDOFF.md only if the intent asks');
  });

  it('size: a review check, a fifth scenario or a needs chain two deep makes a task full', () => {
    draft(root, '# t\n', THREE + '- { id: d, then: w, check: { type: review, path: doc.md, lang: en } }\n');
    expect(buildStateView(root, root).size).toBe('full');
    approve(root, null);
    expect(buildStateView(root, root).next).toBe('build a, b, c, d — then vibe check --all; on a failure, vibe context <id> then vibe check <id>');
    draft(root, '# t\n', THREE + '- { id: d, then: w, needs: [c], check: { type: run, cmd: "true" } }\n');
    expect(buildStateView(root, root).size).toBe('full');
    draft(root, '# t\n', THREE);
    expect(buildStateView(root, root).size).toBe('small');
  });
});
