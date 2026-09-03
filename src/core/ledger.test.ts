import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compare, readLedger, record } from './ledger.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-ledger-'));
  fs.mkdirSync(path.join(root, '.vibe'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function check(client: string, passed: number, scenarioSet = 'set-a', model: string | null = null): void {
  record(root, { event: 'check', client, model, run: 'r', scenarioSet, passed, failed: 0 });
}

describe('장부와 비교 — 판정 불가를 코드가 낸다', () => {
  it('append 만 한다', () => {
    record(root, { event: 'init', client: 'claude-code', model: null });
    record(root, { event: 'draft', client: 'codex', model: 'gpt' });
    expect(readLedger(root).map((e) => e.client)).toEqual(['claude-code', 'codex']);
  });

  it('arm 당 5런 미만이면 insufficient-runs', () => {
    check('claude-code', 3);
    check('codex', 3);
    expect(compare(root, 'client', 'checks').verdict).toBe('insufficient-runs');
  });

  it('시나리오 셋이 다르면 mixed-scenario-sets — 실행을 버리지 않는다', () => {
    for (let i = 0; i < 5; i += 1) check('claude-code', 3, 'set-a');
    for (let i = 0; i < 5; i += 1) check('codex', 3, 'set-b');
    const c = compare(root, 'client', 'checks');
    expect(c.verdict).toBe('mixed-scenario-sets');
    expect(c.arms.map((a) => a.runs)).toEqual([5, 5]);
  });

  it('범위가 겹치면 inconclusive, 안 겹치면 difference-observed (delta 는 절대 단위)', () => {
    for (const v of [3, 4, 5, 4, 3]) check('claude-code', v);
    for (const v of [4, 5, 5, 4, 5]) check('codex', v);
    expect(compare(root, 'client', 'checks').verdict).toBe('inconclusive');
    fs.rmSync(path.join(root, '.vibe', 'ledger.jsonl'));
    for (const v of [1, 2, 2, 1, 2]) check('claude-code', v);
    for (const v of [4, 5, 5, 4, 5]) check('codex', v);
    const c = compare(root, 'client', 'checks');
    expect(c.verdict).toBe('difference-observed');
    expect(c.delta).toBeCloseTo(4.6 - 1.6, 5);
    expect(JSON.stringify(c)).not.toMatch(/ratio|percent|배/);
  });

  it('지표가 없는 런은 usable 에서 빠진다', () => {
    for (let i = 0; i < 5; i += 1) record(root, { event: 'check', client: 'claude-code', model: null, scenarioSet: 'set-a' });
    for (let i = 0; i < 5; i += 1) check('codex', 3);
    const c = compare(root, 'client', 'turns');
    expect(c.verdict).toBe('insufficient-runs');
    expect(c.arms[0]?.usable).toBe(0);
  });
});
