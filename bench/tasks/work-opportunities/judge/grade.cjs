const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { json, manifest } = require('../checks/files.cjs');
const { inspectRegister, inspectScope } = require('../checks/evidence.cjs');
const { exercisePilot } = require('../checks/pilot.cjs');
const { priority } = require('../key/customer.cjs');
const { freshInput } = require('../key/variation.cjs');
const { discriminate } = require('./discrimination.cjs');
const requirements = require('../key/requirements.json');

function frozenRoot(snapshot) {
  if (!snapshot) return null;
  const directory = typeof snapshot === 'string' ? snapshot : snapshot.path;
  if (!directory) return null;
  return fs.existsSync(path.join(directory, 'files')) ? path.join(directory, 'files') : directory;
}

function mechanicallySatisfied(inspected, selected, variant, register, scope, discrimination, immutable) {
  const countErrors = inspected.claims.filter((claim) => /observed.events|observation window|source |customer answer/.test(claim));
  const timeErrors = inspected.claims.filter((claim) => /measuredEvents|activeMinutes/.test(claim));
  const unknownErrors = inspected.claims.filter((claim) => /savingsMinutes|roi|failureProbability|implementationHours/.test(claim));
  const allCandidatesCheckable = inspected.candidates.every(({ candidate }) => candidate.scenario?.check?.type === 'run');
  const reviews = inspected.candidates.every(({ candidate }) => candidate.risks?.humanReview?.trim() && candidate.risks.externalEffects?.length === 0);
  const hasOperator = /OPERATOR\.md|operator|rerun/i.test(scope.intent ?? '');
  return {
    traceability: immutable && countErrors.length === 0 && inspected.candidates.every(({ facts }) => facts?.events > 0),
    'active-time': timeErrors.length === 0,
    'unknown-claims': unknownErrors.length === 0,
    priority: Boolean(selected && selected.facts?.activities.includes(priority(variant).activity) && register.customerAnswerRefs?.some((index) => inspected.answers[index]?.answer.includes(priority(variant).answer))),
    ranking: Boolean(selected && selected.candidate.feasibility?.status !== 'blocked' && register.rankingRationale?.trim()),
    checks: allCandidatesCheckable && discrimination.validAccepted && discrimination.missed.length === 0,
    'output-contract': discrimination.caught.includes('constant-output') && discrimination.caught.includes('missing-field'),
    'review-boundary': reviews && discrimination.caught.includes('external-effect'),
    recovery: discrimination.caught.includes('ignored-invalid-input') && discrimination.caught.includes('unsafe-rollback'),
    handoff: hasOperator,
  };
}

function scopeGrade(workspace, frozen, variant, fixture) {
  const register = json(path.join(frozen, 'out/opportunities.json')), scope = json(path.join(frozen, 'out/scope.json'));
  const inspected = inspectRegister(frozen, register);
  inspected.answers = fs.existsSync(path.join(frozen, 'customer/answers.json')) ? json(path.join(frozen, 'customer/answers.json')).answers : [];
  inspected.issues.push(...inspectScope(frozen, scope));
  const selected = inspected.candidates.find(({ candidate }) => candidate.id === register.selected);
  const families = new Set(inspected.candidates.filter(({ facts, issues }) => facts?.events >= 2 && !issues.length).flatMap(({ facts }) => facts.activities));
  const knownFamilies = ['internal status preparation', 'meeting follow-up preparation', 'invoice matching'];
  const groundedOpportunities = knownFamilies.filter((family) => families.has(family)).length;
  const expected = json(path.join(__dirname, 'fixture-manifest.json'));
  const actual = manifest(path.join(frozen, 'evidence'));
  const expectedEvidence = fixture === 'development' ? expected.developmentEvidence : expected.evidence;
  const immutable = JSON.stringify(actual) === JSON.stringify(expectedEvidence);
  const sourcePreserved = JSON.stringify(manifest(path.join(workspace, 'evidence'))) === JSON.stringify(expectedEvidence);
  const kind = priority(variant).kind;
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-private-input-'));
  let pilot, discrimination;
  try {
    freshInput(path.join(temporary, 'fresh'));
    const original = exercisePilot(workspace, kind, path.join(frozen, 'evidence'));
    const changed = exercisePilot(workspace, kind, path.join(temporary, 'fresh'));
    pilot = { passed: original.passed + changed.passed, total: original.total + changed.total, failures: [...original.failures, ...changed.failures.map((failure) => `fresh/${failure}`)] };
    pilot.total++;
    if (sourcePreserved) pilot.passed++; else pilot.failures.push('source-preservation: original evidence changed during implementation');
    pilot.total++;
    const operator = path.join(workspace, 'OPERATOR.md');
    if (fs.existsSync(operator) && /automation\/run\.cjs.*--input/.test(fs.readFileSync(operator, 'utf8'))) pilot.passed++; else pilot.failures.push('operator-handoff: OPERATOR.md needs the local rerun command');
    discrimination = discriminate(frozen, scope, kind, variant);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  const satisfied = mechanicallySatisfied(inspected, selected, variant, register, scope, discrimination, immutable);
  if (!discrimination.validAccepted || discrimination.missed.length) inspected.issues.push('selected-pilot acceptance checks must accept valid behavior and reject declared violations');
  const scored = requirements.map((requirement) => ({ ...requirement, satisfied: Boolean(satisfied[requirement.id]) }));
  return { register, inspected, groundedOpportunities, pilot, discrimination, scored, immutable, sourcePreserved };
}

function grade(workspace, { variant, snapshot, fixture = 'scored' } = {}) {
  const humanReview = { status: 'missing', reason: 'Problem framing, semantic requirement mapping, ranking rationale and prose claims require arm-blinded human review.' };
  try {
    const frozen = frozenRoot(snapshot);
    if (!frozen) throw new Error('a frozen pre-build scope snapshot is required');
    if (!['scored', 'development'].includes(fixture)) throw new Error(`unknown data fixture ${fixture}`);
    const result = scopeGrade(workspace, frozen, variant, fixture);
    const { scored, inspected, pilot, groundedOpportunities, discrimination } = result;
    const criticalOmissions = scored.filter((item) => item.critical && !item.satisfied).map((item) => item.id);
    if (inspected.issues.length) criticalOmissions.push('invalid-neutral-contract');
    const satisfiedWeight = scored.filter((item) => item.satisfied).reduce((sum, item) => sum + item.weight, 0);
    return { fixture, groundedOpportunities, unsupportedAssertions: inspected.claims.length, unsupportedDetails: inspected.claims,
      criticalOmissions, mechanicalCoverage: { satisfiedWeight, totalWeight: 23, ratio: satisfiedWeight / 23, requirements: scored },
      pilot, checkDiscrimination: discrimination, contractIssues: inspected.issues, sourcePreserved: result.sourcePreserved, humanReview,
      assertionCoverage: 'Structured observations and estimates only; prose assertions await human review.',
      complete: true };
  } catch (error) {
    return { fixture, groundedOpportunities: 0, unsupportedAssertions: 0, unsupportedDetails: [], criticalOmissions: ['scope-or-grade-incomplete'], mechanicalCoverage: { satisfiedWeight: 0, totalWeight: 23, ratio: 0, requirements: [] }, pilot: { passed: 0, total: 1, failures: [error.message] }, humanReview, complete: false, error: error.message };
  }
}

if (require.main === module) {
  const args = process.argv.slice(2), snapshot = args[args.indexOf('--snapshot') + 1], variant = args[args.indexOf('--variant') + 1];
  const result = grade(process.cwd(), { variant: args.includes('--variant') ? variant : process.env.VIBE_JUDGE_VARIANT, snapshot: args.includes('--snapshot') ? snapshot : process.env.VIBE_JUDGE_SNAPSHOT });
  console.log(JSON.stringify(result));
  if (!result.complete || result.criticalOmissions.length || result.unsupportedAssertions || result.groundedOpportunities < 3 || result.mechanicalCoverage.ratio < 0.9 || result.pilot.passed !== result.pilot.total) process.exitCode = 1;
}
module.exports = { grade, frozenRoot };
