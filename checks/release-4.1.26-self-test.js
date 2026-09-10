import assert from 'node:assert/strict';
import { evaluate } from '../bench/fde/release.js';
import { schedule, TARGETS } from '../bench/fde/protocol.js';
import { digest } from '../bench/fde/evidence.js';
import { packetId } from '../bench/fde/reviews.js';

const hash = 'a'.repeat(64);
const revision = 'b'.repeat(40);
const requirements = [3, 2, 3, 3, 2, 2, 3, 3, 1, 1].map((weight, i) => ({ id: `requirement-${i}`, weight, critical: [0, 1, 2, 3, 6, 7].includes(i) }));
export function example() {
  const protocol = { id: 'fde-discovery-v1', status: 'frozen', candidateRevision: revision, baselineRevision: '2d2af57', schedule: schedule(), targets: TARGETS,
    pins: { runner: hash, fixture: hash, rubric: hash }, products: { baseline: hash, candidate: hash },
    settings: Object.fromEntries(['claude', 'codex'].map((client) => [client, { model: 'test-model', sources: { model: { source: 'test-fixture' } }, maxTurns: client === 'claude' ? 40 : null, turnLimit: client === 'claude' ? 'client-enforced' : 'unavailable-use-shared-time-limit' }])),
    limits: { sessions: 6, clarificationRounds: 2, scopeCorrections: 1, sessionMs: 1000, attemptMs: 6000, concurrencyPerClient: 1 },
    budget: { rawTokens: 10000000, wallMs: 100000, unknownMoneyAccepted: true }, humanReview: { calibration: { artifact: 'test-only' }, rubricHash: hash } };
  const rows = protocol.schedule.map((plan) => {
    const tokens = { input: plan.arm === 'scoped-4.1.26' ? 70 : 100, cacheRead: 0, cacheWrite: 0, output: 10 };
    return { ...plan, event: 'attempt', protocol: protocol.id, protocolHash: digest(protocol), runnerHash: hash, fixtureHash: hash,
      harnessRevision: plan.arm === 'off' ? null : plan.arm === 'scoped-4.1.25' ? protocol.baselineRevision : revision, model: 'test-model',
      tokens, usage: 'captured', ms: 100, scopeSnapshots: [{ hash: digest(plan.id) }], gradedScopeHash: digest(plan.id),
      sessions: [{ tokens, phase: 'discovery', phaseAllocation: 'unavailable-within-session' }],
      events: ['intake', 'scope', 'approval', 'build', 'proof', 'handoff'].map((phase) => ({ phase, allocation: 'unavailable' })),
      customer: { clarificationRounds: 1, corrections: 0 }, privateGrade: { complete: true, fixture: 'scored', sourcePreserved: true, mechanicalCoverage: { ratio: 1 }, criticalOmissions: [], unsupportedAssertions: 0, groundedOpportunities: 3, pilot: { passed: 5, total: 5 } } };
  });
  const ratings = rows.flatMap((row) => Array.from({ length: row.doubleReview ? 2 : 1 }, (_, index) => ({ packet: packetId(row), scopeHash: row.scopeSnapshots[0].hash, kind: 'human', reviewer: `fixture-person-${index}`, at: '2026-09-10', reason: 'Unit-test fixture, never cohort evidence',
    requirements: requirements.map((r) => ({ id: r.id, satisfied: true, reason: 'fixture', evidence: ['out/scope.json'] })), unsupportedAssertions: 0, unnecessaryScope: 0, correctProblem: true })));
  const ci = ['linux', 'windows'].map((platform) => ({ platform, revision, status: 'passed', url: 'fixture-only', at: '2026-09-10' }));
  return { protocol, rows, ratings, requirements, ci };
}

export function selfTest() {
  const assess = (fixture) => evaluate(fixture.protocol, fixture.rows, fixture.ratings, fixture.requirements, fixture.ci);
  assert.equal(assess(example()).ok, true, 'complete synthetic evidence must pass');
  const broken = [
    ['missing cell', (f) => f.rows.pop()],
    ['missing human review', (f) => { f.ratings = []; }],
    ['missing usage', (f) => { f.rows[0].tokens = null; }],
    ['API failure', (f) => { f.rows[0].error = 'HTTP 500'; }],
    ['stalled', (f) => { f.rows[0].stalled = true; }],
    ['baseline revision', (f) => { f.rows.find((r) => r.arm === 'scoped-4.1.25').harnessRevision = 'wrong'; }],
    ['phase attribution', (f) => { f.rows[0].sessions[0].phaseAllocation = 'guessed-half'; }],
    ['critical omission', (f) => { f.rows.find((r) => r.arm === 'scoped-4.1.26').privateGrade.criticalOmissions = ['critical']; }],
    ['cross-client quality', (f) => { f.rows.find((r) => r.client === 'codex' && r.arm === 'scoped-4.1.26').privateGrade.pilot.passed = 4; }],
    ['cross-client cost', (f) => { for (const r of f.rows.filter((r) => r.client === 'codex' && r.arm === 'scoped-4.1.26')) { r.tokens.input = 200; } }],
    ['customer burden', (f) => { f.rows.find((r) => r.arm === 'scoped-4.1.26').customer.corrections = 1; }],
    ['duplicate replacement', (f) => f.rows.push(structuredClone(f.rows[0]))],
    ['threshold relaxation', (f) => { f.protocol.targets = { ...TARGETS, weightedInputRatio: 2 }; }],
    ['Windows evidence', (f) => { f.ci.pop(); }],
    ['unsupported claim', (f) => { f.rows.find((r) => r.arm === 'scoped-4.1.26').privateGrade.unsupportedAssertions = 1; }],
    ['invented human verdict', (f) => { f.ratings[0].kind = 'model'; }],
    ['side-model omitted', (f) => { f.rows[0].sideUsage = [{ tokens: { input: 10, cacheRead: 0, cacheWrite: 0, output: 2 } }]; }],
    ['development rows', (f) => { f.rows[0].privateGrade.fixture = 'development'; }],
    ['missing grade metric', (f) => { delete f.rows[0].privateGrade.unsupportedAssertions; }],
    ['amended grade substituted', (f) => { f.rows[0].gradedScopeHash = 'later scope'; }],
  ];
  for (const [name, mutate] of broken) { const fixture = example(); mutate(fixture); assert.equal(assess(fixture).ok, false, name); }
  console.log(`4.1.26 release --self-test: ${broken.length + 1} deterministic evidence checks passed; no scored rows written`);
}
