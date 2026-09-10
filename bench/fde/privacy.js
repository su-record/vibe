import { createHash } from 'node:crypto';

const digest = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value ?? null)).digest('hex');
export const contentSummary = (value) => ({ sha256: digest(value), bytes: Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value ?? null)) });
const codes = new Set(['CLIENT_START_FAILED', 'CLIENT_TIMEOUT', 'CLIENT_EXIT_NONZERO', 'CLIENT_RESULT_ERROR', 'CLIENT_TRANSPORT_INCOMPLETE', 'DIAGNOSTIC_WRITE_FAILED', 'USAGE_MISSING', 'AGENT_EVIDENCE_UNAVAILABLE', 'GRADE_FAILED', 'GRADE_INCOMPLETE', 'HARNESS_ERROR', 'ATTEMPT_INTERRUPTED', 'SESSION_USAGE_INTERRUPTED', 'TOKEN_BUDGET_REACHED', 'WALL_BUDGET_REACHED', 'CURRENCY_USAGE_MISSING', 'CURRENCY_BUDGET_REACHED', 'ATTEMPT_TIME_LIMIT']);
export const failureCode = (value, fallback = 'HARNESS_ERROR') => value ? codes.has(value) ? value : fallback : null;
const pick = (object, names) => Object.fromEntries(names.filter((name) => object?.[name] !== undefined).map((name) => [name, object[name]]));
const tokens = (value) => value && ['input', 'cacheRead', 'cacheWrite', 'output'].every((key) => Number.isFinite(value[key]) && value[key] >= 0) ? pick(value, ['input', 'cacheRead', 'cacheWrite', 'output']) : null;
const measurements = ['requestedModel', 'model', 'costUsd', 'ms', 'usage', 'exit', 'signal', 'invoked'];
const numeric = (value) => Number.isFinite(value) ? value : null;
const timestamp = (value) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(value) ? value : null;

export function safeSession(session) {
  return { ...pick(session, measurements), tokens: tokens(session.tokens), models: session.models?.map((item) => ({ model: item.model, tokens: tokens(item.tokens) })), error: failureCode(session.errorCode ?? session.error), errorCode: failureCode(session.errorCode ?? session.error),
    finalTextSummary: contentSummary(session.finalText ?? ''), toolCalls: { count: session.toolCalls?.length ?? 0, ...contentSummary(session.toolCalls ?? []) },
    errorDetails: contentSummary(session.errors ?? session.error ?? null), transport: session.transport,
    diagnostics: session.diagnostics ?? [], ...pick(session, ['phase', 'started', 'finished', 'phaseAllocation']) };
}

export function safeUsage(entry) {
  return { model: entry.model, costUsd: numeric(entry.costUsd), at: timestamp(entry.at), tokens: tokens(entry.tokens), error: failureCode(entry.error), errorCode: failureCode(entry.error), details: contentSummary(entry) };
}

export function safeEvent(event) {
  return { ...pick(event, ['at', 'phase', 'allocation', 'simulated', 'approved']), details: contentSummary(event) };
}

export function safeVerification(value) {
  const states = ['NONE', 'DRAFT', 'APPROVED', 'RUNNING', 'DONE', 'STUCK', 'STALE', 'ABANDONED', 'WAITING'];
  return value ? { state: states.includes(value.state) ? value.state : 'UNKNOWN', passed: numeric(value.passed), failed: numeric(value.failed), at: timestamp(value.at), details: contentSummary(value.results ?? {}) } : null;
}

export function safeScope(value) {
  return value ? { scenarios: numeric(value.scenarios), approved: value.approved === true, checkTypes: { count: value.checks?.length ?? 0, ...contentSummary(value.checks ?? []) } } : null;
}

export function safeGrade(grade) {
  if (!grade) return null;
  const result = pick(grade, ['complete', 'fixture', 'sourcePreserved', 'groundedOpportunities', 'unsupportedAssertions', 'criticalOmissions']);
  if (grade.mechanicalCoverage) result.mechanicalCoverage = { ...pick(grade.mechanicalCoverage, ['ratio', 'satisfiedWeight', 'totalWeight']),
    requirements: grade.mechanicalCoverage.requirements?.map((item) => pick(item, ['id', 'weight', 'critical', 'satisfied'])) };
  if (grade.pilot) result.pilot = { ...pick(grade.pilot, ['passed', 'total']), failureCount: grade.pilot.failures?.length ?? 0, failures: contentSummary(grade.pilot.failures ?? []) };
  if (grade.checkDiscrimination) result.checkDiscrimination = { ...pick(grade.checkDiscrimination, ['validAccepted', 'total', 'caught', 'missed']), falseRejections: contentSummary(grade.checkDiscrimination.falseRejections ?? []) };
  return { ...result, errorCode: grade.complete === false ? 'GRADE_INCOMPLETE' : null, details: contentSummary(grade) };
}

export function safeSnapshot(snapshot) {
  return { ...pick(snapshot, ['hash', 'path', 'at', 'reason']), files: Object.keys(snapshot.manifest ?? {}).length, private: true };
}
