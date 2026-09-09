import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compare, readLedger, record, recordUsage } from './ledger.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-ledger-'));
  fs.mkdirSync(path.join(root, '.vibe'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function check(client: string, passed: number, scenarioSet = 'set-a', model: string | null = null): void {
  record(root, { event: 'check', client, model, run: 'r', scenarioSet, passed, failed: 0 });
}

describe('ledger and comparison — the code says "cannot tell"', () => {
  it.each([false, true])('three arms: no pairwise verdict in any record order (paired=%s)', (paired) => {
    const file = path.join(root, 'three-arms.jsonl');
    const orders = [['off', 'on', 'scoped'], ['off', 'scoped', 'on'], ['on', 'off', 'scoped'],
      ['on', 'scoped', 'off'], ['scoped', 'off', 'on'], ['scoped', 'on', 'off']];
    for (const order of orders) {
      const rows = order.flatMap((harness) => Array.from({ length: harness === 'scoped' ? 1 : 5 }, (_, i) => ({
        event: 'check', client: 'codex', harness, scenarioSet: 's', pair: `${harness}#${i}`,
        passed: harness === 'scoped' ? 0 : 5, failed: harness === 'scoped' ? 5 : 0,
        armPassed: harness !== 'scoped', ms: harness === 'off' ? 10 : harness === 'on' ? 20 : 0,
      })));
      fs.writeFileSync(file, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
      expect(compare(root, 'harness', 'ms', 5, file, paired)).toMatchObject({
        verdict: 'inconclusive', delta: null, arms: expect.arrayContaining([expect.objectContaining({ arm: 'scoped', runs: 1 })]),
        reason: 'more than two arms to compare — filter the ledger to exactly two harness arms',
      });
    }
  });

  it('harness: compares on/off arms from a bench ledger file outside any project', () => {
    const file = path.join(root, 'bench.jsonl');
    for (const v of [5, 5, 4, 5, 5]) fs.appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), event: 'check', client: 'claude-code', model: null, harness: 'on', run: 'r', scenarioSet: 's', passed: v, failed: 5 - v })}\n`);
    for (const v of [2, 3, 2, 3, 3]) fs.appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), event: 'check', client: 'claude-code', model: null, harness: 'off', run: 'r', scenarioSet: 's', passed: v, failed: 5 - v })}\n`);
    const c = compare(root, 'harness', 'checks', 5, file);
    expect(c.arms.map((a) => a.arm)).toEqual(['on', 'off']);
    expect(c.verdict).toBe('difference-observed');
    expect(c.delta).toBeCloseTo(-2.2);
  });

  it('only appends', () => {
    record(root, { event: 'init', client: 'claude-code', model: null });
    record(root, { event: 'draft', client: 'codex', model: 'gpt' });
    expect(readLedger(root).map((e) => e.client)).toEqual(['claude-code', 'codex']);
  });

  it('fewer than 5 runs per arm is insufficient-runs', () => {
    check('claude-code', 3);
    check('codex', 3);
    expect(compare(root, 'client', 'checks').verdict).toBe('insufficient-runs');
  });

  it('different scenario sets are mixed-scenario-sets — runs are kept, not discarded', () => {
    for (let i = 0; i < 5; i += 1) check('claude-code', 3, 'set-a');
    for (let i = 0; i < 5; i += 1) check('codex', 3, 'set-b');
    const c = compare(root, 'client', 'checks');
    expect(c.verdict).toBe('mixed-scenario-sets');
    expect(c.arms.map((a) => a.runs)).toEqual([5, 5]);
  });

  it('overlapping ranges are inconclusive; disjoint ranges are difference-observed (delta in absolute units)', () => {
    for (const v of [3, 4, 5, 4, 3]) check('claude-code', v);
    for (const v of [4, 5, 5, 4, 5]) check('codex', v);
    expect(compare(root, 'client', 'checks').verdict).toBe('inconclusive');
    fs.rmSync(path.join(root, '.vibe', 'ledger.jsonl'));
    for (const v of [1, 2, 2, 1, 2]) check('claude-code', v);
    for (const v of [4, 5, 5, 4, 5]) check('codex', v);
    const c = compare(root, 'client', 'checks');
    expect(c.verdict).toBe('difference-observed');
    expect(c.delta).toBeCloseTo(4.6 - 1.6, 5);
    expect(JSON.stringify(c)).not.toMatch(/ratio|percent/);
  });

  it('runs without the metric drop out of usable', () => {
    for (let i = 0; i < 5; i += 1) record(root, { event: 'check', client: 'claude-code', model: null, scenarioSet: 'set-a' });
    for (let i = 0; i < 5; i += 1) check('codex', 3);
    const c = compare(root, 'client', 'turns');
    expect(c.verdict).toBe('insufficient-runs');
    expect(c.arms[0]?.usable).toBe(0);
  });

  it('usage: a reader or reviewer call inside a project leaves tokens, cost and the run in progress; outside a project nothing; compare --metric cost adds it to the run', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-usage-out-'));
    expect(recordUsage(outside, { detail: 'reader', client: 'claude', model: 'haiku', tokens: { input: 1, cacheRead: 0, cacheWrite: 0, output: 1 }, costUsd: 0.001, ms: 5 })).toBeNull();
    expect(fs.existsSync(path.join(outside, '.vibe'))).toBe(false);
    fs.rmSync(outside, { recursive: true, force: true });

    fs.mkdirSync(path.join(root, '.vibe'), { recursive: true });
    fs.writeFileSync(path.join(root, '.vibe', 'state.json'), JSON.stringify({ state: 'RUNNING', runs: 2 }));
    const e = recordUsage(root, { detail: 'review ko/copy-editor', client: 'claude', model: 'claude-opus-5', tokens: { input: 1204, cacheRead: 0, cacheWrite: 0, output: 3 }, costUsd: 0.01, ms: 900 });
    expect(e).toMatchObject({ event: 'usage', run: 'r-3', detail: 'review ko/copy-editor', tokens: { input: 1204 }, costUsd: 0.01 });
    expect(readLedger(root).filter((x) => x.event === 'usage')).toHaveLength(1);
    // five checks per arm with a scenario set; the usage of run r-3 lands on the check that carries r-3
    for (const [client, i] of [['a', 0], ['a', 1], ['a', 2], ['a', 3], ['a', 4], ['b', 5], ['b', 6], ['b', 7], ['b', 8], ['b', 9]] as Array<[string, number]>) {
      record(root, { event: 'check', client, model: null, run: `r-${i}`, scenarioSet: 'S', passed: 1, failed: 0, costUsd: 0.1 });
    }
    const c = compare(root, 'client', 'cost');
    const armA = c.arms.find((a) => a.arm === 'a');
    expect(armA?.range?.max).toBeCloseTo(0.11, 5); // r-3 carries the 0.01 of the review stage
    expect(c.arms.find((a) => a.arm === 'b')?.range?.max).toBeCloseTo(0.1, 5);
  });

  it('paired: keeps only runs that pair with a passing run in the other arm, on the same task', () => {
    const file = path.join(root, 'bench.jsonl');
    const line = (harness: string, i: number, ms: number, extra: Partial<Parameters<typeof record>[1]> = {}) =>
      `${JSON.stringify({ at: new Date().toISOString(), event: 'check', client: 'claude-code', model: null, harness, run: `r-${i}`, scenarioSet: 's', task: 't', pair: `t#${i}`, passed: 5, failed: 0, ms, ...extra })}\n`;
    for (let i = 0; i < 3; i += 1) {
      fs.appendFileSync(file, line('on', i, 1000 + i));
      fs.appendFileSync(file, line('off', i, 2000 + i));
    }
    fs.appendFileSync(file, line('on', 3, 9999)); // unpaired — no "off" run at index 3
    fs.appendFileSync(file, line('on', 4, 1500)); // pairs, but the other side failed — excluded too
    fs.appendFileSync(file, line('off', 4, 2500, { passed: 4, failed: 1 }));

    const unpaired = compare(root, 'harness', 'ms', 2, file);
    expect(unpaired.arms.find((a) => a.arm === 'on')?.runs).toBe(5);

    const c = compare(root, 'harness', 'ms', 2, file, true);
    expect(c.arms.find((a) => a.arm === 'on')?.runs).toBe(3);
    expect(c.arms.find((a) => a.arm === 'off')?.runs).toBe(3);
    expect(c.verdict).toBe('difference-observed');

    // a ledger without a `pair` field falls back to task + order within each arm
    const legacy = path.join(root, 'legacy.jsonl');
    const legacyLine = (harness: string, i: number, ms: number) =>
      `${JSON.stringify({ at: new Date().toISOString(), event: 'check', client: 'claude-code', model: null, harness, run: `r-${i}`, scenarioSet: 's', task: 'legacy', passed: 5, failed: 0, ms })}\n`;
    for (let i = 0; i < 3; i += 1) {
      fs.appendFileSync(legacy, legacyLine('on', i, 100 + i));
      fs.appendFileSync(legacy, legacyLine('off', i, 200 + i));
    }
    expect(compare(root, 'harness', 'ms', 2, legacy, true).arms.map((a) => a.runs)).toEqual([3, 3]);
  });

  it('recomputed: costMismatch counts a run whose recomputed cost differs from the reported cost by more than 3x', () => {
    for (let i = 0; i < 5; i += 1) record(root, { event: 'check', client: 'claude-code', model: null, run: `r-${i}`, scenarioSet: 'set-a', passed: 3, failed: 0, costUsd: 0.1, costRecomputed: i === 0 ? 0.5 : 0.11 });
    for (let i = 0; i < 5; i += 1) record(root, { event: 'check', client: 'codex', model: null, run: `r-${i}`, scenarioSet: 'set-a', passed: 3, failed: 0, costUsd: 0.1, costRecomputed: 0.1 });
    const c = compare(root, 'client', 'checks');
    expect(c.arms.find((a) => a.arm === 'claude-code')?.costMismatch).toBe(1);
    expect(c.arms.find((a) => a.arm === 'codex')?.costMismatch).toBe(0);
  });

  it('filter: --client and --task keep only the matching runs of a bench ledger', () => {
    const file = path.join(root, 'bench.jsonl');
    const line = (client: string, task: string, harness: string, i: number, passed: number): string => JSON.stringify({ at: new Date(Date.now() + i).toISOString(), event: 'check', client, model: null, harness, task, run: `r-${i}`, scenarioSet: task, passed, failed: 0, turns: passed * 2 });
    const lines: string[] = [];
    let i = 0;
    for (const client of ['claude-code', 'codex']) for (const task of ['settlement', 'report']) for (const harness of ['on', 'off']) for (let k = 0; k < 5; k += 1) lines.push(line(client, task, harness, (i += 1), harness === 'on' ? 5 : 3));
    fs.writeFileSync(file, `${lines.join('\n')}\n`);
    const filtered = compare(root, 'harness', 'checks', 5, file, false, { client: 'codex', task: 'report' });
    expect(filtered.arms.map((a) => a.runs)).toEqual([5, 5]);
    expect(filtered.verdict).toBe('difference-observed');
    const mixed = compare(root, 'harness', 'checks', 5, file, false, { client: 'codex' });
    expect(mixed.verdict).toBe('mixed-scenario-sets'); // two tasks in one arm
  });

  it('tokens: --metric tokens compares weighted input (input + 0.1 cacheRead + 1.25 cacheWrite)', () => {
    const file = path.join(root, 'tok.jsonl');
    const line = (harness: string, i: number, tokens: { input: number; cacheRead: number; cacheWrite: number; output: number }): string => JSON.stringify({ at: new Date(Date.now() + i).toISOString(), event: 'check', client: 'c', model: null, harness, task: 'brownfield', run: `r-${i}`, pair: `brownfield#${i % 5}`, scenarioSet: 'b', passed: 5, failed: 0, armPassed: true, tokens });
    const lines: string[] = [];
    for (let i = 0; i < 5; i += 1) lines.push(line('on', i, { input: 1000, cacheRead: 10000, cacheWrite: 400, output: 100 }), line('off', i, { input: 5000, cacheRead: 30000, cacheWrite: 0, output: 100 }));
    fs.writeFileSync(file, `${lines.join('\n')}\n`);
    const c = compare(root, 'harness', 'tokens', 5, file, true);
    expect(c.verdict).toBe('difference-observed');
    expect(c.arms.find((a) => a.arm === 'on')?.range?.mean).toBeCloseTo(1000 + 1000 + 500, 5);
    expect(c.arms.find((a) => a.arm === 'off')?.range?.mean).toBeCloseTo(5000 + 3000, 5);
  });
});
