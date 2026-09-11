import { describe, it, expect } from 'vitest';
import { safeSliceReads, sliceDelta, sliceTotals, sliceReport } from './read-slices.js';
import { safeSession } from './privacy.js';
import { renderReport } from './report.js';
import { evaluate } from './release.js';
import { example } from '../../checks/release-4.1.26-fixtures.js';

const candidate = 'scoped-4.1.26';
const session = (before, after) => ({ sliceReads: sliceDelta(true, before, after) });
const zero = { blocked: 0, warned: 0 };

describe('slice-read measurements', () => {
  it('distinguishes unsupported, unreadable, reset and observed zero counters', () => {
    expect(sliceDelta(false, zero, zero)).toMatchObject({ supported: false, status: 'not-instrumented', counts: null });
    expect(sliceDelta(true, null, zero)).toMatchObject({ supported: true, status: 'unavailable', counts: null });
    expect(sliceDelta(true, { blocked: 2, warned: 1 }, zero)).toMatchObject({ status: 'counter-reset', counts: null });
    expect(sliceDelta(true, zero, zero)).toMatchObject({ status: 'captured', counts: zero });
    expect(sliceDelta(true, zero, { blocked: -1, warned: 0 }).counts).toBeNull();
  });

  it('sums session increments once and preserves known partial totals', () => {
    const sessions = [session({ blocked: 4, warned: 5 }, { blocked: 6, warned: 6 }), session({ blocked: 6, warned: 6 }, { blocked: 7, warned: 9 })];
    expect(sliceTotals(candidate, sessions)).toMatchObject({ counts: { blocked: 3, warned: 4 }, sessions: 2, observedSessions: 2 });
    expect(sliceTotals(candidate, sessions, 3)).toMatchObject({ status: 'unavailable', counts: null, observedCounts: { blocked: 3, warned: 4 }, observedSessions: 2 });
    expect(sliceTotals(candidate, [])).toMatchObject({ status: 'not-started', counts: null });
    expect(sliceTotals('off', sessions)).toMatchObject({ supported: false, counts: null, observedCounts: null });
  });

  it('only serializes supported numeric counter fields, never raw commands or files', () => {
    const marker = 'PRIVATE_COMMAND_OR_FILE';
    const input = { ...sliceDelta(true, zero, { blocked: 2, warned: 1 }), command: marker, files: [marker] };
    const serialized = JSON.stringify(safeSession({ sliceReads: input }));
    expect(serialized).not.toContain(marker);
    expect(JSON.parse(serialized).sliceReads.counts).toEqual({ blocked: 2, warned: 1 });
    expect(safeSliceReads({ supported: true, status: marker, counts: { blocked: 0, warned: marker } })).toMatchObject({ status: 'unavailable', counts: null });
  });

  it('reports error-attempt counts and missing observations without changing quality or cost decisions', () => {
    const fixture = example();
    const baseline = evaluate(fixture.protocol, fixture.rows, fixture.requirements, fixture.ci);
    for (const row of fixture.rows) row.sliceReads = sliceTotals(row.arm, [session(zero, { blocked: 2, warned: 3 })]);
    const result = evaluate(fixture.protocol, fixture.rows, fixture.requirements, fixture.ci);
    expect(result.ok).toBe(baseline.ok); expect(result.quality).toEqual(baseline.quality); expect(result.cost).toEqual(baseline.cost);
    const report = renderReport(fixture.protocol, result);
    expect(report).toContain('Slice-read blocks'); expect(report).toContain('not instrumented');
    const failed = fixture.rows.find((row) => row.arm === candidate); failed.errorCode = 'CLIENT_TIMEOUT';
    const summary = sliceReport(fixture.rows, ['claude', 'codex'], ['off', 'scoped-4.1.25', candidate]);
    expect(summary.find((row) => row.client === failed.client && row.arm === candidate)).toMatchObject({ recorded: 10, observedAttempts: 10, counts: { blocked: 20, warned: 30 } });
    delete failed.sliceReads;
    const missing = sliceReport(fixture.rows, [failed.client], [candidate])[0];
    expect(missing).toMatchObject({ counts: null, unavailableAttempts: 1, observedCounts: { blocked: 18, warned: 27 } });
  });
});
