import { it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { sliceCounter, withSliceCounts, ledgerSliceTotals } from './read-slice-source.js';

const candidate = 'scoped-4.1.26', home = path.join(os.tmpdir(), 'counter-fixture-home'), workspace = path.join(os.tmpdir(), 'counter-fixture-project');
const env = { HOME: home, USERPROFILE: home };

it('uses the fixture home and never installs or reads counters for bare or baseline products', () => {
  let loads = 0, initialized = 0;
  const loader = () => { loads++; return {
    initializeSliceCounts: (root, passed) => { expect(root).toBe(workspace); expect(passed).toBe(env); initialized++; return true; },
    readSliceCounts: (root, passed) => { expect(root).toBe(workspace); expect(passed).toBe(env); return { blocked: 0, warned: 0 }; },
  }; };
  for (const arm of ['off', 'scoped-4.1.25']) expect(sliceCounter(arm, workspace, workspace, env, loader)).toMatchObject({ supported: false });
  expect(loads).toBe(0);
  expect(sliceCounter(candidate, workspace, workspace, {}, loader).read()).toBeNull(); expect(loads).toBe(0);
  expect(sliceCounter(candidate, workspace, workspace, env, loader).read()).toEqual({ blocked: 0, warned: 0 });
  expect(initialized).toBe(1);
  expect(sliceCounter(candidate, workspace, workspace, env, () => { throw new Error('fixture source unavailable'); }).read()).toBeNull();
});

it('records increments when an invocation fails without leaking its error text into the count record', async () => {
  let index = 0;
  const counter = { supported: true, read: () => [{ blocked: 2, warned: 1 }, { blocked: 3, warned: 4 }][index++] };
  const records = [];
  await expect(withSliceCounts(counter, async () => { throw new Error('PRIVATE_COMMAND'); }, (reading) => records.push(reading))).rejects.toThrow('PRIVATE_COMMAND');
  expect(records).toHaveLength(1); expect(records[0].counts).toEqual({ blocked: 1, warned: 3 });
  expect(JSON.stringify(records)).not.toContain('PRIVATE_COMMAND');
});

it('keeps missing and duplicate session observations unknown instead of substituting or double-counting them', () => {
  const reading = { supported: true, status: 'captured', counts: { blocked: 1, warned: 2 } };
  const records = [{ id: 'a', event: 'session-start', session: 1 }, { id: 'a', event: 'slice-reads', session: 1, sliceReads: reading },
    { id: 'a', event: 'session-start', session: 2 }, { id: 'other', event: 'slice-reads', session: 2, sliceReads: reading }];
  expect(ledgerSliceTotals(candidate, records, 'a')).toMatchObject({ counts: null, observedCounts: { blocked: 1, warned: 2 }, sessions: 2, observedSessions: 1 });
  records.push({ ...records[1] });
  expect(ledgerSliceTotals(candidate, records, 'a')).toMatchObject({ counts: null, observedCounts: null, observedSessions: 0 });
  expect(ledgerSliceTotals('scoped-4.1.25', records, 'a')).toMatchObject({ supported: false, counts: null });
});
