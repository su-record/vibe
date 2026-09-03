import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { evalCheck } from './eval.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-eval-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const UPPER = `node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(d.toUpperCase()))"`;

describe('eval check — a count of matching cases, never a ratio', () => {
  it('eval: passes when at least expect.pass cases match and reports the mismatches', async () => {
    fs.writeFileSync(path.join(root, 'cases.jsonl'), [
      JSON.stringify({ id: 'a', input: 'hello', expected: 'HELLO' }),
      JSON.stringify({ id: 'b', input: 'x', expected: 'X' }),
      JSON.stringify({ id: 'c', input: 'ok', expected: 'nope' }),
      JSON.stringify({ id: 'd', input: { k: 1 }, expected: { K: 1 } }),
    ].join('\n'));
    const two = await evalCheck({ type: 'eval', cases: 'cases.jsonl', runner: UPPER, expect: { pass: 3 } }, root);
    expect(two).toMatchObject({ pass: true, exit: 0 });
    expect(two.tail).toContain('3 of 4 cases matched (need 3)');
    expect(two.tail).toContain('c: got "OK"');
    const all = await evalCheck({ type: 'eval', cases: 'cases.jsonl', runner: UPPER, expect: { pass: 4 } }, root);
    expect(all).toMatchObject({ pass: false, exit: 1, reason: '3 of 4 cases matched (need 4)' });
  });

  it('eval: unreadable cases fail with a reason instead of throwing', async () => {
    const r = await evalCheck({ type: 'eval', cases: 'missing.jsonl', runner: UPPER, expect: { pass: 1 } }, root);
    expect(r.pass).toBe(false);
    expect(r.reason).toContain('cases unreadable');
  });
});
