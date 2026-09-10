import { ARMS, ASSESSMENT_LIMITATION } from './protocol.js';

const value = (n) => n === null || !Number.isFinite(n) ? 'unknown' : n.toFixed(2);
export function renderReport(protocol, result) {
  const lines = [`# 4.1.26 discovery evidence`, '', `Protocol: ${protocol.id}. Candidate revision: ${protocol.candidateRevision ?? 'not frozen'}.`, '',
    `Release objective: ${result.ok ? 'met' : 'unmet'}. Evidence: ${result.evidence.ok ? 'complete' : 'incomplete'}. Deterministic indicators: ${result.quality.ok ? 'passed' : 'not passed'}. Cost/customer burden: ${result.cost.ok ? 'passed' : 'not passed'}.`, '', ASSESSMENT_LIMITATION, '',
    `${result.evidence.recorded}/60 planned attempts recorded; ${result.evidence.usable} usable. Errors: ${result.evidence.apiOrHarnessErrors}; stalled: ${result.evidence.stalled}. No failed attempt is replaced.`, '',
    '| Client / customer | Arm | Usable | Mechanical agreement coverage | Private pilot behavior |', '| --- | --- | ---: | ---: | ---: |'];
  for (const cell of result.quality.cells) for (const arm of ARMS) {
    const data = cell.arms[arm];
    lines.push(`| ${cell.client} / ${cell.variant} | ${arm} | ${data.usable} | ${value(data.mechanicalCoverage)} | ${value(data.behavior)} |`);
  }
  lines.push('', '| Client / customer | Arm | Critical omissions | Unsupported structured assertions | Grounded opportunities | Sources preserved |', '| --- | --- | ---: | ---: | ---: | ---: |');
  for (const cell of result.quality.cells) for (const arm of ARMS) {
    const data = cell.arms[arm];
    lines.push(`| ${cell.client} / ${cell.variant} | ${arm} | ${value(data.criticalOmissions)} | ${value(data.unsupportedAssertions)} | ${value(data.groundedOpportunities)} | ${value(data.sourcePreserved)} |`);
  }
  lines.push('', '| Client | Arm | Matched | Weighted input | Output tokens | Customer response rounds | Machine ms | Known USD |', '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const cell of result.cost.clients) for (const arm of ARMS) {
    const data = cell.arms[arm];
    lines.push(`| ${cell.client} | ${arm} | ${data.n} | ${value(data.weightedInput)} | ${value(data.output)} | ${value(data.customerResponses)} | ${value(data.machineMs)} | ${value(data.costUsd)} |`);
  }
  lines.push('', 'Customer response rounds are a burden proxy, not measured customer minutes. Machine time is not human time saved. Savings and monetary ROI are not measured. Prices absent from the frozen configuration mean unknown money. This synthetic case does not establish broad prevention or general FDE superiority.', '',
    'Mechanical agreement coverage is recomputed from weighted requirements in frozen pre-build artifacts; behavior is checked separately on the pilot. Table values are means among usable attempts, and every candidate must also meet the per-attempt floor. Unsupported assertions cover structured fields only. Optional human diagnostics do not affect execution authorization or release gates. The pilot still requires human review before any external action.', '',
    'Agent verification summaries, command counts/hashes, and private behavior metrics remain separate in the append-only ledger. Original messages and transport output require explicit private diagnostics; shared rows never contain them. Within-session phase tokens/tool counts are unavailable; measured session totals are retained. Efficiency uses only matched accepted completions with equally weighted customer variants.', '',
    'The machine-readable assessment below includes every exclusion and failing target. Linux and Windows require CI evidence for the candidate revision; local Linux checks alone do not establish Windows compatibility.', '',
    '```json', JSON.stringify(result, null, 2), '```', '');
  return lines.join('\n');
}
