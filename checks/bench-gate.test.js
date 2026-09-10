import { describe, expect, it } from 'vitest';
import { gate, SETS } from './bench-gate.js';

const TRAP_SETS = { ...SETS, direction: ['anomaly', ...SETS.direction] };

function completeLedger(sets = SETS) {
  const rows = [];
  for (const [set, tasks] of Object.entries(sets)) {
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
    ['one stalled attempt', (rows) => rows.map((r) => r.pair.endsWith('#4') ? { ...r, stalled: true } : r), '4 usable run(s) in its latest 5 attempts, needs 5 (1 stalled)'],
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
    const rows = completeLedger(TRAP_SETS).map((r) => r.task === 'anomaly' && r.harness === 'on' ? { ...r, passed: 1 } : r);
    expect(gate(rows, TRAP_SETS)).toMatchObject({ ok: false, reason: expect.stringContaining('on 1.00 checks is worse than off 3.00') });
  });

  it('allows scoped separation when on equals off', () => {
    const rows = completeLedger(TRAP_SETS).map((r) => r.task === 'anomaly' && r.harness === 'on' ? { ...r, passed: 3 } : r);
    expect(gate(rows, TRAP_SETS).ok).toBe(true);
  });

  it('still requires turn observations when a diagnostic trap is selected', () => {
    const rows = completeLedger(TRAP_SETS).map((r) => r.task === 'anomaly' ? { ...r, turns: null } : r);
    expect(gate(rows, TRAP_SETS)).toMatchObject({ ok: false, reason: expect.stringContaining('turns observations') });
  });

  it('retains retired observations without making them release gates', () => {
    const rows = completeLedger(TRAP_SETS).map((r) => r.task === 'anomaly' ? { ...r, error: 'preserved failed attempt' } : r);
    expect(gate(rows).ok).toBe(true);
    const diagnostic = gate(rows, TRAP_SETS);
    expect(diagnostic).toMatchObject({ ok: false, reason: expect.stringContaining('anomaly:') });
    expect(diagnostic.reason).toContain('usable run(s)');
  });

  it('does not claim direction success when a required task was not measured', () => {
    const result = gate(completeLedger().filter((r) => r.task !== 'handover'));
    expect(result.ok).toBe(false);
    expect(result.results.some((r) => r.set === 'direction' && r.ok)).toBe(false);
  });
});
