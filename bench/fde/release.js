import { CLIENTS, VARIANTS, ARMS, TARGETS, ASSESSMENT_LIMITATION, protocolErrors } from './protocol.js';
import { digest } from './evidence.js';
import { weightedInput, addTokens } from './clients.js';
import { failureCode } from './privacy.js';
import { completeCapture } from './capture-policy.js';

const mean = (rows, get) => rows.length ? rows.reduce((sum, row) => sum + get(row), 0) / rows.length : null;
const tokenValues = (tokens) => tokens && ['input', 'cacheRead', 'cacheWrite', 'output'].every((key) => Number.isFinite(tokens[key]) && tokens[key] >= 0);
const behavior = (row) => row.privateGrade.pilot.passed / row.privateGrade.pilot.total;

function validCoverage(grade, requirements) {
  const coverage = grade?.mechanicalCoverage;
  if (!coverage || !Array.isArray(coverage.requirements) || coverage.requirements.length !== requirements.length) return false;
  const entries = coverage.requirements;
  if (!requirements.every((requirement) => {
    const matches = entries.filter((item) => item.id === requirement.id), item = matches[0];
    return matches.length === 1 && item.weight === requirement.weight && item.critical === requirement.critical
      && typeof item.satisfied === 'boolean' && (!item.critical || item.satisfied || grade.criticalOmissions?.includes(item.id));
  })) return false;
  const total = requirements.reduce((sum, item) => sum + item.weight, 0);
  const satisfied = entries.filter((item) => item.satisfied).reduce((sum, item) => sum + item.weight, 0);
  return coverage.totalWeight === total && coverage.satisfiedWeight === satisfied && coverage.ratio === satisfied / total;
}

function validGrade(grade, requirements) {
  return grade?.complete === true && grade.fixture === 'scored'
    && typeof grade.sourcePreserved === 'boolean'
    && Number.isInteger(grade.groundedOpportunities) && grade.groundedOpportunities >= 0
    && Number.isInteger(grade.unsupportedAssertions) && grade.unsupportedAssertions >= 0
    && Array.isArray(grade.criticalOmissions) && grade.criticalOmissions.every((id) => typeof id === 'string')
    && Number.isInteger(grade.pilot?.total) && grade.pilot.total > 0 && Number.isInteger(grade.pilot.passed)
    && grade.pilot.passed >= 0 && grade.pilot.passed <= grade.pilot.total
    && validCoverage(grade, requirements);
}

function rowErrors(row, plan, protocol, requirements) {
  const errors = [];
  for (const key of ['client', 'variant', 'arm', 'attempt']) if (row[key] !== plan[key]) errors.push(`${key} differs from plan`);
  if (row.protocolHash !== digest(protocol) || row.protocol !== protocol.id || row.runnerHash !== protocol.pins.runner || row.fixtureHash !== protocol.pins.fixture) errors.push('protocol/runner/fixture mismatch');
  const revision = row.arm === ARMS[1] ? protocol.baselineRevision : row.arm === ARMS[2] ? protocol.candidateRevision : null;
  if (row.harnessRevision !== revision) errors.push('harness revision mismatch');
  if (row.model !== protocol.settings[row.client]?.model) errors.push('model mismatch');
  if (row.error || row.errorCode || row.stalled || row.incomplete) errors.push(failureCode(row.errorCode ?? row.error) ?? (row.stalled ? 'stalled' : 'incomplete'));
  if (!tokenValues(row.tokens) || row.usage !== 'captured') errors.push('missing usage');
  if (!row.scopeSnapshots?.length || row.prematureBuild) errors.push('missing pre-build approved scope');
  if (!validGrade(row.privateGrade, requirements)) errors.push('missing/invalid scored private grade or inconsistent mechanical coverage');
  if (row.gradedScopeHash !== row.scopeSnapshots?.[0]?.hash) errors.push('discovery grade must use the initial pre-build agreement');
  if (!row.sessions?.length || row.sessions.some((s) => !tokenValues(s.tokens) || s.phaseAllocation !== 'unavailable-within-session' || !['discovery', 'implementation'].includes(s.phase))) errors.push('missing or invented phase attribution');
  if (row.sessions?.some((session) => !completeCapture(session))) errors.push('missing, failed or incomplete bounded transport');
  const aggregate = addTokens([...(row.sessions ?? []).map((s) => s.tokens), ...(row.sideUsage ?? []).map((s) => s.tokens)]);
  if (!aggregate || JSON.stringify(aggregate) !== JSON.stringify(row.tokens)) errors.push('session/side usage is missing or does not reconcile');
  const phases = new Set(row.events?.map((entry) => entry.phase));
  if (!['intake', 'scope', 'approval', 'build', 'proof', 'handoff'].every((phase) => phases.has(phase))) errors.push('missing phase boundaries');
  if (row.events?.some((event) => event.allocation !== 'unavailable')) errors.push('invented phase allocation');
  if (!Number.isInteger(row.customer?.clarificationRounds) || !Number.isInteger(row.customer?.corrections)) errors.push('missing customer burden proxy');
  if (!Number.isFinite(row.ms) || row.ms < 0) errors.push('missing machine time');
  return errors;
}

function qualityFloor(row) {
  const grade = row.privateGrade;
  const reasons = [];
  if (grade.criticalOmissions.length) reasons.push('critical omission');
  if (grade.unsupportedAssertions) reasons.push('unsupported structured assertion');
  if (grade.groundedOpportunities < TARGETS.groundedFamilies) reasons.push('missing grounded recurring families');
  if (grade.mechanicalCoverage.ratio < TARGETS.scopeFloor) reasons.push('mechanical agreement coverage below 90%');
  if (behavior(row) !== 1) reasons.push('selected pilot behavior failed');
  if (!grade.sourcePreserved) reasons.push('pilot changed source evidence');
  return reasons;
}

function compareQuality(usable, problems) {
  const cells = [];
  for (const client of CLIENTS) for (const variant of VARIANTS) {
    const select = (arm) => usable.filter((r) => r.client === client && r.variant === variant && r.arm === arm);
    const groups = ARMS.map(select);
    const scores = groups.map((group) => ({ usable: group.length, mechanicalCoverage: mean(group, (r) => r.privateGrade.mechanicalCoverage.ratio), behavior: mean(group, behavior),
      criticalOmissions: mean(group, (r) => r.privateGrade.criticalOmissions.length), unsupportedAssertions: mean(group, (r) => r.privateGrade.unsupportedAssertions),
      groundedOpportunities: mean(group, (r) => r.privateGrade.groundedOpportunities), sourcePreserved: mean(group, (r) => Number(r.privateGrade.sourcePreserved)) }));
    cells.push({ client, variant, arms: Object.fromEntries(ARMS.map((arm, index) => [arm, scores[index]])) });
    if (groups.some((group) => group.length !== 5)) continue;
    for (const index of [0, 1]) for (const metric of ['mechanicalCoverage', 'behavior']) {
      if (scores[2][metric] < scores[index][metric]) problems.push(`${client}/${variant}: candidate ${metric} worse than ${ARMS[index]}`);
    }
  }
  return cells;
}

function compareCost(usable, problems) {
  const costs = [];
  for (const client of CLIENTS) {
    const complete = usable.filter((row) => row.client === client && !qualityFloor(row).length);
    const matched = complete.filter((row) => ARMS.every((arm) => complete.some((other) => other.arm === arm && other.variant === row.variant && other.attempt === row.attempt)));
    const metrics = ARMS.map((arm) => {
      const mine = matched.filter((row) => row.arm === arm);
      return { n: mine.length, weightedInput: mean(mine, (r) => weightedInput(r.tokens)), output: mean(mine, (r) => r.tokens.output),
        customerResponses: mean(mine, (r) => r.customer.clarificationRounds + r.customer.corrections), machineMs: mean(mine, (r) => r.ms),
        costUsd: mine.length && mine.every((r) => Number.isFinite(r.costUsd)) ? mean(mine, (r) => r.costUsd) : null };
    });
    const excluded = usable.filter((row) => row.client === client && !matched.includes(row)).map((row) => row.id);
    costs.push({ client, arms: Object.fromEntries(ARMS.map((arm, index) => [arm, metrics[index]])), excluded });
    if (metrics.some((m) => m.n !== 10)) { problems.push(`${client}: incomplete matched accepted completions for efficiency`); continue; }
    if (metrics[2].weightedInput > metrics[1].weightedInput * TARGETS.weightedInputRatio) problems.push(`${client}: candidate exceeds 0.80 baseline weighted input`);
    for (const metric of ['output', 'customerResponses']) if (metrics[2][metric] > metrics[1][metric]) problems.push(`${client}: candidate increases ${metric}`);
  }
  return costs;
}

export function evaluate(protocol, records, requirements, ci) {
  const evidenceProblems = protocolErrors(protocol);
  if (requirements.reduce((sum, r) => sum + r.weight, 0) !== 23) evidenceProblems.push('rubric weights do not total 23');
  const rows = records.filter((row) => row.event === 'attempt');
  const usable = [];
  const excluded = [];
  for (const plan of protocol.schedule ?? []) {
    const found = rows.filter((row) => row.id === plan.id);
    if (found.length !== 1) { evidenceProblems.push(`${plan.id}: expected one preserved attempt, found ${found.length}`); continue; }
    const row = found[0];
    const errors = rowErrors(row, plan, protocol, requirements);
    if (errors.length) { excluded.push({ id: row.id, reasons: errors }); evidenceProblems.push(`${row.id}: ${errors.join('; ')}`); }
    else usable.push(row);
  }
  if (rows.some((row) => !protocol.schedule?.some((plan) => plan.id === row.id))) evidenceProblems.push('unplanned replacement/retry present');
  for (const platform of ['linux', 'windows']) if (!ci?.some((entry) => entry.platform === platform && entry.revision === protocol.candidateRevision && entry.status === 'passed' && entry.url && entry.at)) evidenceProblems.push(`${platform}: missing CI evidence for candidate revision`);
  const qualityProblems = usable.filter((row) => row.arm === ARMS[2]).flatMap((row) => qualityFloor(row).map((reason) => `${row.id}: ${reason}`));
  const cells = compareQuality(usable, qualityProblems);
  const costProblems = [];
  const costs = compareCost(usable, costProblems);
  return { ok: !evidenceProblems.length && !qualityProblems.length && !costProblems.length, limitation: ASSESSMENT_LIMITATION,
    evidence: { ok: !evidenceProblems.length, problems: evidenceProblems, planned: 60, recorded: rows.length, usable: usable.length,
      apiOrHarnessErrors: rows.filter((r) => r.error).length, stalled: rows.filter((r) => r.stalled).length, excluded },
    quality: { ok: !qualityProblems.length && !evidenceProblems.length, problems: qualityProblems, cells },
    cost: { ok: !costProblems.length && !evidenceProblems.length, problems: costProblems, clients: costs } };
}
