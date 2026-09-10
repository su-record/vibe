import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { schedule, TARGETS, SETTINGS, BUDGET, LIMITS, ASSESSMENT, ASSESSMENT_LIMITATION } from '../bench/fde/protocol.js';
import { digest } from '../bench/fde/evidence.js';

const hash = 'a'.repeat(64), revision = 'b'.repeat(40);
const requirements = JSON.parse(fs.readFileSync(new URL('../bench/tasks/work-opportunities/key/requirements.json', import.meta.url), 'utf8'));
const repo = fileURLToPath(new URL('..', import.meta.url));

export function example() {
  const protocol = { id: 'fde-discovery-v1', status: 'frozen', candidateRevision: revision, baselineRevision: '2d2af57', schedule: schedule(), targets: TARGETS,
    clientVersions: { claude: 'fixture-cli-1', codex: 'fixture-cli-2' }, nodeVersion: 'fixture-runtime',
    pins: { runner: hash, fixture: hash, rubric: hash }, products: { baseline: hash, candidate: hash },
    settings: Object.fromEntries(['claude', 'codex'].map((client) => [client, { ...SETTINGS[client],
      sources: Object.fromEntries(Object.entries(SETTINGS[client]).map(([key, value]) => [key, { value, source: 'self-test fixture' }])),
      maxTurns: client === 'claude' ? 40 : null, turnLimit: client === 'claude' ? 'client-enforced' : 'unavailable-use-shared-time-limit' }])),
    limits: { ...LIMITS }, diagnostics: { enabled: false, directory: null },
    budget: { ...BUDGET }, assessment: ASSESSMENT };
  const rows = protocol.schedule.map((plan) => {
    const tokens = { input: plan.arm === 'scoped-4.1.26' ? 70 : 100, cacheRead: 0, cacheWrite: 0, output: 10 };
    return { ...plan, event: 'attempt', protocol: protocol.id, protocolHash: digest(protocol), runnerHash: hash, fixtureHash: hash,
      harnessRevision: plan.arm === 'off' ? null : plan.arm === 'scoped-4.1.25' ? protocol.baselineRevision : revision, model: SETTINGS[plan.client].model,
      tokens, usage: 'captured', ms: 100, scopeSnapshots: [{ hash: digest(plan.id) }], gradedScopeHash: digest(plan.id),
      sessions: [{ tokens, phase: 'discovery', phaseAllocation: 'unavailable-within-session' }],
      events: ['intake', 'scope', 'approval', 'build', 'proof', 'handoff'].map((phase) => ({ phase, allocation: 'unavailable' })),
      customer: { clarificationRounds: 1, corrections: 0 }, privateGrade: { complete: true, fixture: 'scored', sourcePreserved: true,
        mechanicalCoverage: { ratio: 1, totalWeight: 23, satisfiedWeight: 23, requirements: requirements.map((item) => ({ ...item, satisfied: true })) },
        criticalOmissions: [], unsupportedAssertions: 0, groundedOpportunities: 3, pilot: { passed: 5, total: 5 } } };
  });
  const ci = ['linux', 'windows'].map((platform) => ({ platform, revision, status: 'passed', url: 'fixture-only', at: '2026-09-10' }));
  return { protocol, rows, requirements, ci };
}

export function omitRequirements(row, ids) {
  const grade = row.privateGrade, coverage = grade.mechanicalCoverage;
  for (const requirement of coverage.requirements.filter((item) => ids.includes(item.id))) {
    requirement.satisfied = false;
    if (requirement.critical) grade.criticalOmissions.push(requirement.id);
  }
  coverage.satisfiedWeight = coverage.requirements.filter((item) => item.satisfied).reduce((sum, item) => sum + item.weight, 0);
  coverage.ratio = coverage.satisfiedWeight / coverage.totalWeight;
}

export function reportCases() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-assessment-report-')), home = path.join(directory, 'home');
  fs.mkdirSync(home);
  const run = (script, args) => spawnSync(process.execPath, [path.join(repo, script), ...args], { cwd: directory, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, HOME: home, USERPROFILE: home, VIBE_SKIP_SETUP: '1' } });
  try {
    const fixture = example();
    fs.writeFileSync(path.join(directory, 'protocol.json'), JSON.stringify(fixture.protocol));
    for (const [file, rows] of [['ledger.jsonl', fixture.rows], ['ci.jsonl', fixture.ci]]) fs.writeFileSync(path.join(directory, file), rows.map((row) => JSON.stringify(row)).join('\n'));
    let original;
    for (const ratings of [null, '{"verdict":"adverse","correctProblem":false}', '{"verdict":"favorable"}', 'invalid optional diagnostic JSON']) {
      if (ratings !== null) fs.writeFileSync(path.join(directory, 'reviews.jsonl'), ratings);
      const result = run('bench/fde-report.js', ['--cohort', directory]);
      assert.equal(result.status, 0, result.stderr); assert.ok(result.stdout.includes(ASSESSMENT_LIMITATION));
      const report = fs.readFileSync(path.join(directory, 'results.md'), 'utf8');
      assert.ok(report.includes('Release objective: met.')); assert.ok(report.includes(ASSESSMENT_LIMITATION));
      if (original) assert.equal(report, original, 'absent/adverse/favorable/malformed optional ratings must not change the report or gate');
      original = report;
    }
    fixture.rows.find((row) => row.arm === 'scoped-4.1.26').privateGrade.criticalOmissions = ['review-boundary'];
    fs.writeFileSync(path.join(directory, 'ledger.jsonl'), fixture.rows.map((row) => JSON.stringify(row)).join('\n'));
    const rejected = run('bench/fde-report.js', ['--cohort', directory]);
    assert.equal(rejected.status, 0, rejected.stderr);
    assert.ok(fs.readFileSync(path.join(directory, 'results.md'), 'utf8').includes('Release objective: unmet.'));
    assert.ok(rejected.stdout.includes(ASSESSMENT_LIMITATION));
    for (const [script, args] of [['bench/fde-report.js', ['--cohort', path.join(directory, 'absent')]], ['checks/release-4.1.26.js', []]]) {
      const failure = run(script, args); assert.equal(failure.status, 1);
      assert.ok(`${failure.stdout}${failure.stderr}`.includes(ASSESSMENT_LIMITATION));
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
