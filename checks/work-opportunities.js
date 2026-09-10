#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { prepareWorkspace, gradingWorkspace, vibeSync, agentEnvironment } from '../bench/workspace.js';
import { freezeScope, treeManifest } from '../bench/snapshot.js';

const require = createRequire(import.meta.url);
const repo = fileURLToPath(new URL('..', import.meta.url)), task = path.join(repo, 'bench/tasks/work-opportunities');
const { respond, proposal, priority } = require(path.join(task, 'key/customer.cjs'));
const { writeScope, build } = require(path.join(task, 'key/reference.cjs'));
const { breakScope, breakPilot } = require(path.join(task, 'key/broken.cjs'));
const { grade } = require(path.join(task, 'judge/grade.cjs'));
const { events } = require(path.join(task, 'checks/evidence.cjs'));
const { writeJson } = require(path.join(task, 'checks/files.cjs'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-work-opportunities-')), cleanup = [temporary];
const home = path.join(temporary, 'home'); fs.mkdirSync(home);
const developmentTask = path.join(temporary, 'development-task');
fs.cpSync(task, developmentTask, { recursive: true });
fs.cpSync(path.join(task, 'key/development/evidence'), path.join(developmentTask, 'evidence'), { recursive: true });
const context = { repo, env: agentEnvironment({ ...process.env, HOME: home, USERPROFILE: home, VIBE_SKIP_SETUP: '1', VIBE_NO_PLUGIN: '1' }) };

function prepared(variant, harness = 'off', alternative = false, fixture = 'scored') {
  const ws = prepareWorkspace(fixture === 'development' ? developmentTask : task, { ...context, harness, clients: ['claude', 'codex'] }); cleanup.push(ws);
  for (const privateName of ['key', 'judge', 'public']) assert.equal(fs.existsSync(path.join(ws, privateName)), false);
  const question = 'Please confirm which outcome matters most for the first pilot.';
  const response = respond(question, variant); assert.equal(response.status, 'answer');
  writeJson(path.join(ws, 'customer/answers.json'), { answers: [{ question, answer: response.answer }] });
  writeScope(ws, variant, alternative);
  return ws;
}

function frozen(ws, approve = true) {
  if (approve) {
    const scope = JSON.parse(fs.readFileSync(path.join(ws, 'out/scope.json'), 'utf8'));
    const input = JSON.stringify({ intent: scope.intent, scenarios: YAML.stringify(scope.scenarios), sources: ['evidence/worklog.csv', 'customer/answers.json'] });
    const draft = vibeSync(ws, ['intent', 'draft', '--stdin'], context, { input });
    assert.equal(draft.status, 0, draft.stderr || draft.stdout);
    const accepted = vibeSync(ws, ['approve'], context); assert.equal(accepted.status, 0, accepted.stderr || accepted.stdout);
  }
  assert.equal(fs.existsSync(path.join(ws, 'automation/run.cjs')), false, 'scope must be frozen before building');
  const snapshot = freezeScope(ws); cleanup.push(snapshot.path); return snapshot;
}

function isolatedGrade(ws, variant, snapshot, fixture = 'scored') {
  const original = treeManifest(ws), snapshotBefore = treeManifest(path.join(snapshot.path, 'files'));
  const scratch = gradingWorkspace(ws, task);
  try {
    const result = grade(scratch.workspace, { variant, snapshot, fixture });
    assert.deepEqual(treeManifest(ws), original, 'private grading changed the agent workspace');
    assert.deepEqual(treeManifest(path.join(snapshot.path, 'files')), snapshotBefore, 'private grading changed the approved scope');
    assert.equal(result.humanReview.status, 'missing', 'deterministic grading must not invent a human review');
    return result;
  } finally { fs.rmSync(scratch.root, { recursive: true, force: true }); }
}

function accepted(result) {
  assert.equal(result.complete, true, result.error);
  assert.deepEqual(result.criticalOmissions, [], JSON.stringify(result));
  assert.equal(result.unsupportedAssertions, 0);
  assert.equal(result.groundedOpportunities, 3);
  assert.equal(result.mechanicalCoverage.satisfiedWeight, 23);
  assert.equal(result.pilot.passed, result.pilot.total, result.pilot.failures.join('; '));
  assert.equal(result.checkDiscrimination.validAccepted, true);
  assert.deepEqual(result.checkDiscrimination.missed, []);
}

function referenceCase(variant, harness, alternative = false, fixture = 'scored') {
  const ws = prepared(variant, harness, alternative, fixture);
  const decision = proposal(ws, variant); assert.equal(decision.approved, true, decision.answer);
  const snapshot = frozen(ws); build(ws, variant);
  const checked = vibeSync(ws, ['check', '--all'], context);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  accepted(isolatedGrade(ws, variant, snapshot, fixture));
}

function brokenCase(defect, variant, predicate, pilot = false) {
  const ws = prepared(variant, 'off', false, 'development');
  if (!pilot) breakScope(ws, defect);
  const snapshot = frozen(ws, false); build(ws, variant);
  if (pilot) breakPilot(ws, defect, priority(variant).kind);
  const result = isolatedGrade(ws, variant, snapshot, 'development');
  assert.equal(result.complete, true, result.error);
  assert.ok(predicate(result), `${defect} failed for the wrong reason: ${JSON.stringify(result)}`);
  if (pilot) assert.equal(result.mechanicalCoverage.satisfiedWeight, 23, 'implementation failure must not lower frozen agreement coverage');
}

function customerCases() {
  for (const variant of ['status-first', 'followup-first']) {
    for (const text of ['Which work should I focus on first?', 'I need your priority before choosing a pilot.', 'Customer priority is missing.', 'Please confirm the first outcome and the permissions for installation.', 'What matters most to you?']) {
      const result = respond(text, variant); assert.equal(result.status, 'answer', text); assert.ok(result.answer.includes(priority(variant).answer));
    }
    for (const text of ['Done.', 'Here are the proposed options', 'Based on your priority, the local pilot is ready', 'All checks passed.', 'The selected priority is implemented; all checks passed.', 'May I proceed?', 'Please approve the proposed scope.']) assert.equal(respond(text, variant).status, 'report', text);
    assert.equal(respond('Please explain your holiday policy.', variant).status, 'unmatched');
    const ws = prepared(variant);
    fs.rmSync(path.join(ws, 'customer/answers.json'));
    assert.equal(proposal(ws, variant).approved, false, 'an agent-written proposal cannot manufacture the customer answer');
  }
}

function observationFixture() {
  const all = [...events(task).values()];
  for (const [activity, count, measured, minutes] of [['internal status preparation', 10, 10, 80], ['meeting follow-up preparation', 4, 4, 60], ['invoice matching', 6, 0, null], ['slide redesign', 1, 1, 40]]) {
    const group = all.filter((event) => event.activity === activity), timed = group.filter((event) => event.minutes !== null);
    assert.equal(group.length, count); assert.equal(timed.length, measured);
    assert.equal(timed.length ? timed.reduce((sum, event) => sum + event.minutes, 0) : null, minutes);
  }
  assert.equal(require(path.join(task, 'key/requirements.json')).reduce((sum, item) => sum + item.weight, 0), 23);
}

try {
  observationFixture(); customerCases();
  for (const variant of ['status-first', 'followup-first']) for (const harness of ['off', 'on', 'scoped']) referenceCase(variant, harness);
  referenceCase('status-first', 'off', true, 'development');
  brokenCase('duplicate-count', 'status-first', (result) => result.unsupportedDetails.some((detail) => detail.includes('observed.events')));
  for (const defect of ['invented-missing-time', 'meeting-duration']) brokenCase(defect, 'status-first', (result) => result.criticalOmissions.includes('active-time'));
  brokenCase('unsupported-roi', 'status-first', (result) => result.criticalOmissions.includes('unknown-claims'));
  brokenCase('wrong-priority', 'status-first', (result) => result.criticalOmissions.includes('priority'));
  brokenCase('vacuous-checks', 'status-first', (result) => result.checkDiscrimination.missed.length > 0 && result.criticalOmissions.includes('invalid-neutral-contract'));
  brokenCase('invented-owner-date', 'followup-first', (result) => result.pilot.failures.some((failure) => /drafts must reflect/.test(failure)), true);
  brokenCase('hard-coded-output', 'status-first', (result) => result.pilot.failures.some((failure) => /changed-input|fresh/.test(failure)), true);
  brokenCase('external-effect', 'status-first', (result) => result.pilot.failures.some((failure) => /review-boundary/.test(failure)), true);
  brokenCase('source-damage', 'status-first', (result) => result.sourcePreserved === false && result.pilot.failures.some((failure) => /source-preservation/.test(failure)), true);
  brokenCase('missing-handoff', 'status-first', (result) => result.pilot.failures.some((failure) => /operator-handoff/.test(failure)), true);
  const ws = prepared('status-first', 'off', false, 'development'); breakScope(ws, 'unsupported-roi'); const snapshot = frozen(ws, false);
  writeScope(ws, 'status-first'); build(ws, 'status-first');
  assert.ok(isolatedGrade(ws, 'status-first', snapshot, 'development').unsupportedAssertions > 0, 'implementation repaired the frozen agreement invisibly');
  assert.equal(grade(ws, { variant: 'status-first' }).complete, false, 'missing snapshot must be incomplete evidence');
  console.log('work-opportunities: fixed observations, equivalent customer dialogue, public/private paths, two priorities, discriminating checks, reversible pilots and declared negative fixtures');
} finally { for (const directory of cleanup.reverse()) fs.rmSync(directory, { recursive: true, force: true }); }
