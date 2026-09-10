import { agentEvidence } from '../snapshot.js';
import { append, usageSummary } from './evidence.js';
import { rawTokens } from './clients.js';
import { safeSession } from './privacy.js';

export function budgetReason(protocol, records, started) {
  if (records.some((row) => ['session-start', 'session-result'].includes(row.event) && !records.some((entry) => entry.event === 'session-usage' && entry.id === row.id && entry.session === row.session))) return 'SESSION_USAGE_INTERRUPTED';
  const summaries = records.filter((row) => row.event === 'session-usage');
  if (summaries.some((row) => !row.tokens)) return 'USAGE_MISSING';
  if (summaries.reduce((sum, row) => sum + rawTokens(row.tokens), 0) >= protocol.budget.rawTokens) return 'TOKEN_BUDGET_REACHED';
  if (Date.now() - started >= protocol.budget.wallMs) return 'WALL_BUDGET_REACHED';
  if (protocol.budget.usd > 0) {
    if (summaries.some((row) => !Number.isFinite(row.costUsd))) return 'CURRENCY_USAGE_MISSING';
    if (summaries.reduce((sum, row) => sum + row.costUsd, 0) >= protocol.budget.usd) return 'CURRENCY_BUDGET_REACHED';
  }
  return null;
}

/** Main accounting is durable before parsing any agent-written bookkeeping. */
export function recordSession(result, { identity, session, workspace, ledger, records, prices, sideCount }) {
  const main = { ...identity, event: 'session-result', at: new Date().toISOString(), session, result: safeSession(result) };
  append(ledger, main); records.push(main);
  let side;
  try { side = agentEvidence(workspace).sideUsage; }
  catch (error) {
    side = [...Array.from({ length: sideCount }, () => ({})), { tokens: null, error: 'AGENT_EVIDENCE_UNAVAILABLE' }];
    result.error = result.errorCode = 'AGENT_EVIDENCE_UNAVAILABLE';
  }
  const measured = { ...identity, event: 'session-usage', at: new Date().toISOString(), session,
    ...usageSummary([result], side.slice(sideCount), prices), mainTokens: result.tokens };
  append(ledger, measured); records.push(measured);
  return side.length;
}
