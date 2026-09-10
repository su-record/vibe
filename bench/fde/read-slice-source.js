import path from 'node:path';
import { createRequire } from 'node:module';
import { sliceDelta, sliceTotals, safeSliceReads } from './read-slices.js';

const require = createRequire(import.meta.url);

/** Never load a candidate counter in an older/bare arm or fall back to the operator's home. */
export function sliceCounter(arm, product, workspace, env, load = require) {
  const supported = arm === 'scoped-4.1.26';
  if (!supported) return { supported, read: () => null };
  let source;
  try {
    const home = process.platform === 'win32' ? env?.USERPROFILE : env?.HOME;
    if (!home || !path.isAbsolute(home)) return { supported, read: () => null };
    source = load(path.join(product, 'hooks/slice-store.cjs'));
    if (source.initializeSliceCounts(workspace, env) !== true) source = null;
  } catch { source = null; }
  return { supported, read: () => { try { return source?.readSliceCounts(workspace, env) ?? null; } catch { return null; } } };
}

/** Count even an invocation that throws; the callback stores only normalized numeric metadata. */
export async function withSliceCounts(counter, invoke, record) {
  const before = safeSliceReads({ after: counter.read() }).after;
  let result;
  try { result = await invoke(); return result; }
  finally {
    const reading = sliceDelta(counter.supported, before, counter.read());
    if (result) result.sliceReads = reading;
    record(reading);
  }
}

export function ledgerSliceTotals(arm, records, id) {
  const starts = records.filter((row) => row.id === id && row.event === 'session-start');
  const sessions = starts.map((start) => {
    const found = records.filter((row) => row.id === id && row.event === 'slice-reads' && row.session === start.session);
    return found.length === 1 && starts.filter((row) => row.session === start.session).length === 1 ? { sliceReads: found[0].sliceReads } : {};
  });
  return sliceTotals(arm, sessions);
}
