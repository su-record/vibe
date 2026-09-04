import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reviewCheck } from './review.js';

let root: string;
let script: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-review-'));
  script = path.join(root, 'reviewer.js');
  fs.writeFileSync(path.join(root, 'column.md'), '# 제목\n\n이 칼럼은 구체적인 장면에서 시작한다. 편집자가 확인할 사실은 세 가지이고, 문단마다 판단이 하나씩 전진한다.\n');
  fs.writeFileSync(path.join(root, 'contract.md'), 'outlet: weekly column · 900 words\n');
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env['VIBE_REVIEW_CMD'];
});

/** A fake reviewer: answers from a queue file, one reply per call, and records what it was asked. */
function fakeReviewer(replies: string[]): void {
  fs.writeFileSync(path.join(root, 'replies.json'), JSON.stringify(replies));
  fs.writeFileSync(script, `
    const fs = require('fs');
    const q = JSON.parse(fs.readFileSync('${path.join(root, 'replies.json')}', 'utf-8'));
    const prompt = fs.readFileSync(0, 'utf-8');
    fs.appendFileSync('${path.join(root, 'asked.log')}', prompt.split('\\n')[0] + '\\n');
    process.stdout.write(q.shift() ?? '');
    fs.writeFileSync('${path.join(root, 'replies.json')}', JSON.stringify(q));
  `);
  process.env['VIBE_REVIEW_CMD'] = `node ${script}`;
}

describe('review check — the harness runs the reviewers and reads only PASS', () => {
  it('passes when both stages answer exactly PASS, in order, with the contract in the bundle', async () => {
    fakeReviewer(['PASS\n', '  PASS  ']);
    const r = await reviewCheck({ type: 'review', path: 'column.md', contract: 'contract.md' }, root);
    expect(r.pass).toBe(true);
    expect(r.tail).toBe('ko copy-editor: PASS\nko chief-editor: PASS');
    expect(fs.readFileSync(path.join(root, 'asked.log'), 'utf-8').trim().split('\n')).toHaveLength(2);
  });

  it('fails on a REJECT list and keeps it in the tail; the second stage is not asked', async () => {
    fakeReviewer(['REJECT\n2문단 | 근거 없는 최상급 | 독자가 검증 불가 | 수치 출처 추가', 'PASS']);
    const r = await reviewCheck({ type: 'review', path: 'column.md' }, root);
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('copy-editor did not pass');
    expect(r.tail).toContain('REJECT');
    expect(r.tail).toContain('근거 없는 최상급');
    expect(fs.readFileSync(path.join(root, 'asked.log'), 'utf-8').trim().split('\n')).toHaveLength(1);
  });

  it('a PASS with a remark is not a pass', async () => {
    fakeReviewer(['PASS', 'PASS — but consider a shorter headline']);
    const r = await reviewCheck({ type: 'review', path: 'column.md' }, root);
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('chief-editor did not pass');
    expect(r.tail).toContain('ko copy-editor: PASS');
    expect(r.tail).toContain('not PASS');
  });

  it('an unknown language without lang fails with a reason; lang: ko overrides detection', async () => {
    fs.writeFileSync(path.join(root, 'short.md'), 'ok\n');
    fakeReviewer(['PASS', 'PASS']);
    const unknown = await reviewCheck({ type: 'review', path: 'short.md' }, root);
    expect(unknown.pass).toBe(false);
    expect(unknown.reason).toContain('language unknown');
    const forced = await reviewCheck({ type: 'review', path: 'short.md', lang: 'ko' }, root);
    expect(forced.pass).toBe(true);
  });
});
