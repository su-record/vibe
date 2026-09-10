import { agentEvidence } from '../snapshot.js';
import { append, usageSummary } from './evidence.js';
import { rawTokens } from './clients.js';

export function budgetReason(protocol, records, started) {
  if (records.some((row) => row.event === 'session-result' && !records.some((entry) => entry.event === 'session-usage' && entry.id === row.id && entry.session === row.session))) return 'session side usage unavailable after interruption; additional paid calls stopped';
  const summaries = records.filter((row) => row.event === 'session-usage');
  if (summaries.some((row) => !row.tokens)) return 'missing session usage; additional paid calls stopped';
  if (summaries.reduce((sum, row) => sum + rawTokens(row.tokens), 0) >= protocol.budget.rawTokens) return 'token budget reached';
  if (Date.now() - started >= protocol.budget.wallMs) return 'wall budget reached';
  if (protocol.budget.usd > 0) {
    if (summaries.some((row) => !Number.isFinite(row.costUsd))) return 'currency usage unavailable; additional paid calls stopped';
    if (summaries.reduce((sum, row) => sum + row.costUsd, 0) >= protocol.budget.usd) return 'currency budget reached';
  }
  return null;
}

/** Main client bytes are durable before parsing any agent-written bookkeeping. */
export function recordSession(result, { identity, session, workspace, ledger, records, prices, sideCount }) {
  const main = { ...identity, event: 'session-result', at: new Date().toISOString(), session, result };
  append(ledger, main); records.push(main);
  let side;
  try { side = agentEvidence(workspace).sideUsage; }
  catch (error) {
    side = [...Array.from({ length: sideCount }, () => ({})), { tokens: null, error: error.message }];
    result.error = `agent evidence unavailable: ${error.message}`;
  }
  const measured = { ...identity, event: 'session-usage', at: new Date().toISOString(), session,
    ...usageSummary([result], side.slice(sideCount), prices), mainTokens: result.tokens };
  append(ledger, measured); records.push(measured);
  return side.length;
}
