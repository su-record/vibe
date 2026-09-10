import assert from 'node:assert/strict';
import { evaluate } from '../bench/fde/release.js';
import { authorize, ASSESSMENT_LIMITATION, TARGETS } from '../bench/fde/protocol.js';
import { digest } from '../bench/fde/evidence.js';
import { example, omitRequirements, reportCases } from './release-4.1.26-fixtures.js';

const assess = (fixture) => evaluate(fixture.protocol, fixture.rows, fixture.requirements, fixture.ci);
const candidate = (fixture) => fixture.rows.find((row) => row.arm === 'scoped-4.1.26');

function diagnosticCases() {
  const baseline = assess(example());
  for (const diagnostic of [undefined, { status: 'adverse', correctProblem: false, unsupportedAssertions: 12 }, { status: 'favorable', correctProblem: true }]) {
    const fixture = example();
    for (const row of fixture.rows) {
      row.humanReview = diagnostic; row.privateGrade.humanReview = diagnostic;
      row.scopeReview = diagnostic; row.doubleReview = true;
    }
    assert.deepEqual(assess(fixture), baseline, 'optional human diagnostics must not affect release assessment');
    fixture.protocol.humanReview = { calibration: { artifact: '/absent/optional-diagnostic' }, verdict: diagnostic };
    const approval = { approvedBy: 'self-test fixture', approvedAt: '2026-09-10', action: 'run-60-planned-attempts', protocolHash: digest(fixture.protocol) };
    assert.doesNotThrow(() => authorize(fixture.protocol, approval), 'execution approval cannot require human calibration');
    assert.throws(() => authorize(fixture.protocol, { ...approval, protocolHash: 'different protocol' }), /separate human authorization/);
  }
  assert.equal(baseline.limitation, ASSESSMENT_LIMITATION);
}

function mechanicalCases() {
  const regression = example();
  omitRequirements(candidate(regression), ['handoff']);
  const result = assess(regression);
  assert.ok(result.quality.problems.some((reason) => /candidate mechanicalCoverage worse/.test(reason)), 'coverage regression above the absolute floor must fail');
  const omitted = example(); omitRequirements(candidate(omitted), ['ranking', 'handoff']);
  assert.ok(assess(omitted).quality.problems.some((reason) => /coverage below 90%/.test(reason)), 'consistent missing requirements must fail the mechanical floor');
  const dishonest = example(); omitRequirements(candidate(dishonest), ['output-contract']);
  candidate(dishonest).privateGrade.mechanicalCoverage.ratio = 1;
  assert.ok(assess(dishonest).evidence.problems.some((reason) => /inconsistent mechanical coverage/.test(reason)), 'a ratio cannot conceal unsatisfied weighted requirements');
  const exactCost = example();
  for (const row of exactCost.rows.filter((entry) => entry.arm === 'scoped-4.1.26')) row.tokens.input = 80;
  assert.equal(assess(exactCost).ok, true, 'the 0.80 cost boundary remains inclusive');
}

function brokenCases() {
  return [
    ['missing cell', (f) => f.rows.pop()],
    ['missing usage', (f) => { f.rows[0].tokens = null; }],
    ['API failure', (f) => { f.rows[0].error = 'HTTP 500'; }],
    ['stalled', (f) => { f.rows[0].stalled = true; }],
    ['baseline revision', (f) => { f.rows.find((r) => r.arm === 'scoped-4.1.25').harnessRevision = 'wrong'; }],
    ['phase attribution', (f) => { f.rows[0].sessions[0].phaseAllocation = 'guessed-half'; }],
    ['critical omission', (f) => { candidate(f).privateGrade.criticalOmissions = ['critical']; }],
    ['cross-client quality', (f) => { f.rows.find((r) => r.client === 'codex' && r.arm === 'scoped-4.1.26').privateGrade.pilot.passed = 4; }],
    ['cross-client cost', (f) => { for (const r of f.rows.filter((r) => r.client === 'codex' && r.arm === 'scoped-4.1.26')) r.tokens.input = 200; }],
    ['customer burden', (f) => { candidate(f).customer.corrections = 1; }],
    ['duplicate replacement', (f) => f.rows.push(structuredClone(f.rows[0]))],
    ['threshold relaxation', (f) => { f.protocol.targets = { ...TARGETS, weightedInputRatio: 2 }; }],
    ['Windows evidence', (f) => { f.ci.pop(); }],
    ['unsupported structured claim', (f) => { candidate(f).privateGrade.unsupportedAssertions = 1; }],
    ['grounded opportunities', (f) => { candidate(f).privateGrade.groundedOpportunities = 2; }],
    ['source preservation', (f) => { candidate(f).privateGrade.sourcePreserved = false; }],
    ['side-model omitted', (f) => { f.rows[0].sideUsage = [{ tokens: { input: 10, cacheRead: 0, cacheWrite: 0, output: 2 } }]; }],
    ['development rows', (f) => { f.rows[0].privateGrade.fixture = 'development'; }],
    ['missing grade metric', (f) => { delete f.rows[0].privateGrade.unsupportedAssertions; }],
    ['amended grade substituted', (f) => { f.rows[0].gradedScopeHash = 'later scope'; }],
    ['unknown side usage', (f) => { f.rows[0].sideUsage = [{ tokens: null }]; }],
    ['coverage total', (f) => { candidate(f).privateGrade.mechanicalCoverage.totalWeight = 22; }],
    ['coverage satisfied weight', (f) => { candidate(f).privateGrade.mechanicalCoverage.satisfiedWeight = 22; }],
    ['coverage duplicate requirement', (f) => { const entries = candidate(f).privateGrade.mechanicalCoverage.requirements; entries[1] = entries[0]; }],
    ['coverage changed weight', (f) => { candidate(f).privateGrade.mechanicalCoverage.requirements[0].weight = 4; }],
    ['coverage hidden critical omission', (f) => { omitRequirements(candidate(f), ['review-boundary']); candidate(f).privateGrade.criticalOmissions = []; }],
    ['assessment policy', (f) => { delete f.protocol.assessment; }],
    ['approved budget', (f) => { f.protocol.budget.rawTokens++; }],
    ['approved session count', (f) => { f.protocol.limits.sessions++; }],
    ['approved session duration', (f) => { f.protocol.limits.sessionMs++; }],
    ['approved attempt duration', (f) => { f.protocol.limits.attemptMs++; }],
    ['approved Claude turn cap', (f) => { f.protocol.settings.claude.maxTurns++; }],
    ['missing diagnostics decision', (f) => { delete f.protocol.diagnostics; }],
    ['unselected diagnostics path', (f) => { f.protocol.diagnostics.directory = '/not-opted-in'; }],
    ['approved model', (f) => { f.protocol.settings.claude.model = 'another-model'; }],
    ['Claude effort must stay unset', (f) => { f.protocol.settings.claude.effort = 'high'; }],
  ];
}

export function selfTest() {
  assert.equal(assess(example()).ok, true, 'complete deterministic evidence without reviews must pass');
  diagnosticCases(); mechanicalCases(); reportCases();
  const broken = brokenCases();
  for (const [name, mutate] of broken) {
    const fixture = example(); mutate(fixture);
    const result = assess(fixture);
    assert.equal(result.ok, false, name); assert.equal(result.limitation, ASSESSMENT_LIMITATION, name);
  }
  console.log(`4.1.26 release --self-test: optional diagnostics, authorization, mechanical coverage, report CLI and ${broken.length} negative cases passed; no scored rows written`);
}
