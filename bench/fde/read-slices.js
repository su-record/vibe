const candidate = 'scoped-4.1.26';
const statuses = new Set(['captured', 'not-instrumented', 'unavailable', 'counter-reset', 'not-started']);
const valid = (value) => value && ['blocked', 'warned'].every((key) => Number.isSafeInteger(value[key]) && value[key] >= 0);
const counts = (value) => valid(value) ? { blocked: value.blocked, warned: value.warned } : null;
const sum = (entries) => entries.length ? entries.reduce((total, entry) => ({ blocked: total.blocked + entry.blocked, warned: total.warned + entry.warned }), { blocked: 0, warned: 0 }) : null;

export function safeSliceReads(value) {
  return { supported: typeof value?.supported === 'boolean' ? value.supported : null,
    status: statuses.has(value?.status) ? value.status : 'unavailable', counts: counts(value?.counts),
    before: counts(value?.before), after: counts(value?.after) };
}

export function sliceDelta(supported, before, after) {
  if (!supported) return { supported: false, status: 'not-instrumented', counts: null, before: null, after: null };
  const initial = counts(before), final = counts(after);
  if (!initial || !final) return { supported: true, status: 'unavailable', counts: null, before: initial, after: final };
  if (final.blocked < initial.blocked || final.warned < initial.warned) return { supported: true, status: 'counter-reset', counts: null, before: initial, after: final };
  return { supported: true, status: 'captured', counts: { blocked: final.blocked - initial.blocked, warned: final.warned - initial.warned }, before: initial, after: final };
}

export function sliceTotals(arm, sessions, expectedSessions = sessions.length) {
  const supported = arm === candidate;
  if (!supported) return { supported, status: 'not-instrumented', counts: null, observedCounts: null, sessions: expectedSessions, observedSessions: 0 };
  const readings = sessions.map((session) => safeSliceReads(session.sliceReads));
  const observed = readings.filter((reading) => reading.supported && reading.status === 'captured' && reading.counts).map((reading) => reading.counts);
  const observedCounts = sum(observed);
  const complete = observed.length > 0 && observed.length === expectedSessions;
  return { supported, status: !expectedSessions ? 'not-started' : complete ? 'captured' : 'unavailable', counts: complete ? observedCounts : null,
    observedCounts, sessions: expectedSessions, observedSessions: observed.length };
}

export function sliceReport(rows, clients, arms) {
  return clients.flatMap((client) => arms.map((arm) => {
    const attempts = rows.filter((row) => row.event === 'attempt' && row.client === client && row.arm === arm);
    const supported = arm === candidate;
    const captured = supported ? attempts.filter((row) => row.sliceReads?.supported === true && row.sliceReads.status === 'captured' && valid(row.sliceReads.counts)) : [];
    const observed = supported ? attempts.map((row) => counts(row.sliceReads?.observedCounts)).filter(Boolean) : [];
    const notStarted = attempts.filter((row) => row.sliceReads?.status === 'not-started').length;
    return { client, arm, supported, recorded: attempts.length, observedAttempts: captured.length, notStartedAttempts: notStarted,
      unavailableAttempts: supported ? attempts.length - captured.length - notStarted : 0,
      counts: supported && attempts.length > 0 && captured.length === attempts.length ? sum(captured.map((row) => row.sliceReads.counts)) : null,
      observedCounts: sum(observed) };
  }));
}
