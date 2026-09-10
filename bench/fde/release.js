import { CLIENTS, VARIANTS, ARMS, TARGETS, protocolErrors } from './protocol.js';
import { digest } from './evidence.js';
import { reviewedScope } from './reviews.js';
import { weightedInput, addTokens } from './clients.js';

const mean = (rows, get) => rows.length ? rows.reduce((sum, row) => sum + get(row), 0) / rows.length : null;
const tokenValues = (tokens) => tokens && ['input', 'cacheRead', 'cacheWrite', 'output'].every((key) => Number.isFinite(tokens[key]) && tokens[key] >= 0);
const behavior = (row) => row.privateGrade.pilot.passed / row.privateGrade.pilot.total;

function rowErrors(row, plan, protocol) {
  const errors = [];
  for (const key of ['client', 'variant', 'arm', 'attempt', 'doubleReview']) if (row[key] !== plan[key]) errors.push(`${key} differs from plan`);
  if (row.protocolHash !== digest(protocol) || row.protocol !== protocol.id || row.runnerHash !== protocol.pins.runner || row.fixtureHash !== protocol.pins.fixture) errors.push('protocol/runner/fixture mismatch');
  const revision = row.arm === ARMS[1] ? protocol.baselineRevision : row.arm === ARMS[2] ? protocol.candidateRevision : null;
  if (row.harnessRevision !== revision) errors.push('harness revision mismatch');
  if (row.model !== protocol.settings[row.client]?.model) errors.push('model mismatch');
  if (row.error || row.stalled || row.incomplete) errors.push(row.error ?? (row.stalled ? 'stalled' : 'incomplete'));
  if (!tokenValues(row.tokens) || row.usage !== 'captured') errors.push('missing usage');
  if (!row.scopeSnapshots?.length || row.prematureBuild) errors.push('missing pre-build approved scope');
  if (!row.privateGrade?.pilot?.total || !Number.isFinite(row.privateGrade?.mechanicalCoverage?.ratio)) errors.push('missing private grade');
  if (!row.sessions?.length || row.sessions.some((s) => !tokenValues(s.tokens) || s.phaseAllocation !== 'unavailable-within-session' || !['discovery', 'implementation'].includes(s.phase))) errors.push('missing or invented phase attribution');
  const aggregate = addTokens([...(row.sessions ?? []).map((s) => s.tokens), ...(row.sideUsage ?? []).map((s) => s.tokens)]);
  if (aggregate && JSON.stringify(aggregate) !== JSON.stringify(row.tokens)) errors.push('session/side usage does not reconcile');
  const phases = new Set(row.events?.map((entry) => entry.phase));
  if (!['intake', 'scope', 'approval', 'build', 'proof', 'handoff'].every((phase) => phases.has(phase))) errors.push('missing phase boundaries');
  if (row.events?.some((event) => event.allocation !== 'unavailable')) errors.push('invented phase allocation');
  if (!Number.isInteger(row.customer?.clarificationRounds) || !Number.isInteger(row.customer?.corrections)) errors.push('missing customer burden proxy');
  return errors;
}

function qualityFloor(row, scope) {
  const grade = row.privateGrade;
  const reasons = [];
  if (scope.criticalOmissions.length || grade.criticalOmissions?.length) reasons.push('critical omission');
  if (scope.unsupportedAssertions || grade.unsupportedAssertions) reasons.push('unsupported assertion');
  if (!scope.correctProblem) reasons.push('wrong problem framing');
  if (grade.groundedOpportunities < TARGETS.groundedFamilies) reasons.push('missing grounded recurring families');
  if (scope.coverage < TARGETS.scopeFloor) reasons.push('weighted scope below 90%');
  if (behavior(row) !== 1) reasons.push('selected pilot behavior failed');
  return reasons;
}

function compareQuality(usable, problems) {
  const cells = [];
  for (const client of CLIENTS) for (const variant of VARIANTS) {
    const select = (arm) => usable.filter((r) => r.client === client && r.variant === variant && r.arm === arm);
    const groups = ARMS.map(select);
    const scores = groups.map((group) => ({ usable: group.length, scope: mean(group, (r) => r.scopeReview.coverage), behavior: mean(group, behavior) }));
    cells.push({ client, variant, arms: Object.fromEntries(ARMS.map((arm, index) => [arm, scores[index]])) });
    if (groups.some((group) => group.length !== 5)) continue;
    for (const index of [0, 1]) for (const metric of ['scope', 'behavior']) {
      if (scores[2][metric] < scores[index][metric]) problems.push(`${client}/${variant}: candidate ${metric} worse than ${ARMS[index]}`);
    }
  }
  return cells;
}

function compareCost(usable, problems) {
  const costs = [];
  for (const client of CLIENTS) {
    const complete = usable.filter((row) => row.client === client && behavior(row) === 1 && !qualityFloor(row, row.scopeReview).length);
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

export function evaluate(protocol, records, ratings, requirements, ci) {
  const evidenceProblems = protocolErrors(protocol);
  if (requirements.reduce((sum, r) => sum + r.weight, 0) !== 23) evidenceProblems.push('rubric weights do not total 23');
  const rows = records.filter((row) => row.event === 'attempt');
  const usable = [];
  const excluded = [];
  for (const plan of protocol.schedule ?? []) {
    const found = rows.filter((row) => row.id === plan.id);
    if (found.length !== 1) { evidenceProblems.push(`${plan.id}: expected one preserved attempt, found ${found.length}`); continue; }
    const row = found[0];
    const errors = rowErrors(row, plan, protocol);
    const review = reviewedScope(row, ratings, requirements);
    if (review.error) errors.push(review.error);
    if (errors.length) { excluded.push({ id: row.id, reasons: errors }); evidenceProblems.push(`${row.id}: ${errors.join('; ')}`); }
    else usable.push({ ...row, scopeReview: review });
  }
  if (rows.some((row) => !protocol.schedule?.some((plan) => plan.id === row.id))) evidenceProblems.push('unplanned replacement/retry present');
  for (const platform of ['linux', 'windows']) if (!ci?.some((entry) => entry.platform === platform && entry.revision === protocol.candidateRevision && entry.status === 'passed' && entry.url && entry.at)) evidenceProblems.push(`${platform}: missing CI evidence for candidate revision`);
  const qualityProblems = usable.filter((row) => row.arm === ARMS[2]).flatMap((row) => qualityFloor(row, row.scopeReview).map((reason) => `${row.id}: ${reason}`));
  const cells = compareQuality(usable, qualityProblems);
  const costProblems = [];
  const costs = compareCost(usable, costProblems);
  return { ok: !evidenceProblems.length && !qualityProblems.length && !costProblems.length,
    evidence: { ok: !evidenceProblems.length, problems: evidenceProblems, planned: 60, recorded: rows.length, usable: usable.length,
      apiOrHarnessErrors: rows.filter((r) => r.error).length, stalled: rows.filter((r) => r.stalled).length, excluded },
    quality: { ok: !qualityProblems.length && !evidenceProblems.length, problems: qualityProblems, cells },
    cost: { ok: !costProblems.length && !evidenceProblems.length, problems: costProblems, clients: costs } };
}
