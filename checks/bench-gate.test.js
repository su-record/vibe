import { describe, expect, it } from 'vitest';
import { gate, SETS } from './bench-gate.js';

function completeLedger() {
  const rows = [];
  for (const [set, tasks] of Object.entries(SETS)) {
    for (const task of tasks) for (const client of ['claude-code', 'codex']) {
      for (const harness of ['off', 'on', 'scoped']) for (let i = 0; i < 5; i += 1) {
        const passed = task === 'anomaly' && harness === 'off' ? 3 : 5;
        rows.push({ at: new Date(1700000000000 + i * 1000).toISOString(), event: 'check', task, client, harness, pair: `${task}#${i}`,
          passed, failed: 5 - passed, armPassed: passed === 5, turns: 10, ms: 1000,
          tokens: { input: set === 'context' && harness === 'on' ? 500 : 1000, cacheRead: 0, cacheWrite: 0, output: 100 } });
      }
    }
  }
  return rows;
}

describe('release evidence', () => {
  it('accepts complete measurements for all three arms', () => {
    expect(gate(completeLedger()).ok).toBe(true);
  });

  it.each([
    ['all client errors', (rows) => rows.map((r) => ({ ...r, error: 'client failed' })), 'usable run(s)'],
    ['missing scoped arm', (rows) => rows.filter((r) => r.harness !== 'scoped'), 'missing arm(s)'],
    ['four scoped attempts', (rows) => rows.filter((r) => r.harness !== 'scoped' || !r.pair.endsWith('#4')), 'usable run(s)'],
    ['five failing scoped runs', (rows) => rows.map((r) => r.harness === 'scoped' ? { ...r, passed: 0 } : r), 'scoped 0.00 checks is worse'],
    ['missing scores', (rows) => rows.map((r) => ({ ...r, passed: null })), 'usable run(s)'],
    ['missing overhead usage', (rows) => rows.map((r) => r.task === 'report' ? { ...r, tokens: null } : r), 'tokens observations'],
    ['missing handover usage', (rows) => rows.map((r) => r.task === 'handover' ? { ...r, tokens: null } : r), 'tokens observations'],
    ['partial context usage', (rows) => rows.map((r) => r.task === 'brownfield' && r.pair.endsWith('#4') ? { ...r, tokens: null } : r), '4 tokens observations'],
    ['only one completed context run', (rows) => rows.map((r) => r.task === 'brownfield' ? { ...r, armPassed: r.pair.endsWith('#4') } : r), '1 tokens observations'],
    ['non-finite tokens', (rows) => rows.map((r) => ({ ...r, tokens: { ...r.tokens, input: Infinity } })), 'tokens observations'],
    ['negative tokens', (rows) => rows.map((r) => ({ ...r, tokens: { ...r.tokens, cacheRead: -1 } })), 'tokens observations'],
    ['missing elapsed time', (rows) => rows.map((r) => ({ ...r, ms: null })), 'ms observations'],
    ['missing trap turns', (rows) => rows.map((r) => r.task === 'anomaly' ? { ...r, turns: null } : r), 'turns observations'],
    ['unjudged events', (rows) => rows.map((r) => ({ ...r, event: 'usage' })), 'missing task'],
  ])('rejects %s', (_name, change, reason) => {
    expect(gate(change(completeLedger()))).toMatchObject({ ok: false, reason: expect.stringContaining(reason) });
  });

  it('does not replace a recent error with an older successful attempt', () => {
    const rows = completeLedger();
    rows.push({ ...rows[0], at: '2026-09-09T23:00:00Z', error: 'client failed' });
    expect(gate(rows)).toMatchObject({ ok: false, reason: expect.stringContaining('4 usable run(s)') });
  });

  it('rejects on regression even when scoped improves', () => {
    const rows = completeLedger().map((r) => r.task === 'anomaly' && r.harness === 'on' ? { ...r, passed: 1 } : r);
    expect(gate(rows)).toMatchObject({ ok: false, reason: expect.stringContaining('on 1.00 checks is worse than off 3.00') });
  });

  it('allows scoped separation when on equals off', () => {
    const rows = completeLedger().map((r) => r.task === 'anomaly' && r.harness === 'on' ? { ...r, passed: 3 } : r);
    expect(gate(rows).ok).toBe(true);
  });

  it('does not claim direction success when a required task was not measured', () => {
    const result = gate(completeLedger().filter((r) => r.task !== 'anomaly'));
    expect(result.ok).toBe(false);
    expect(result.results.some((r) => r.set === 'direction' && r.ok)).toBe(false);
  });
});
