import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { approve, draft } from './intent.js';
import { runChecks } from './check.js';
import { inspectContract, executionPlan } from './inspect.js';
import { consentStatus, saveConsent } from './consent.js';
import { privateDirectory } from './private-store.js';

let fixture: string, root: string;
beforeEach(() => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-consent-'));
  root = path.join(fixture, 'project');
  fs.mkdirSync(root);
  const home = path.join(fixture, 'home');
  fs.mkdirSync(home);
  vi.stubEnv('HOME', home); vi.stubEnv('USERPROFILE', home);
});
afterEach(() => { vi.unstubAllEnvs(); fs.rmSync(fixture, { recursive: true, force: true }); });
const scenarios = '- { id: proof, then: the check runs, check: { type: run, cmd: "node proof.cjs" }, verifiers: [proof.cjs] }';
function prepare(): void {
  fs.writeFileSync(path.join(root, 'proof.cjs'), 'require("node:fs").writeFileSync("marker", "ran");');
  draft(root, '# Consent fixture', scenarios);
}

it('inspects and previews without executing, initializing storage, or changing records', () => {
  fs.writeFileSync(path.join(root, 'intent.md'), '# inherited');
  fs.writeFileSync(path.join(root, 'scenarios.yaml'), scenarios);
  const inspected = inspectContract(root, ['intent.md', 'scenarios.yaml']);
  expect(inspected.scenarios[0]?.check.type).toBe('run');
  expect(fs.existsSync(path.join(root, '.vibe'))).toBe(false);
  expect(fs.existsSync(privateDirectory(root, false))).toBe(false);
  prepare();
  const before = fs.readFileSync(path.join(root, '.vibe', 'state.json'));
  expect(executionPlan(root).checks).toHaveLength(1);
  expect(executionPlan(root).checks[0]?.timeoutMs).toBe(600_000);
  expect(fs.readFileSync(path.join(root, '.vibe', 'state.json'))).toEqual(before);
  expect(fs.existsSync(path.join(root, 'marker'))).toBe(false);
});

it('copied approval cannot execute in a destination; artifact edits reuse local consent', async () => {
  prepare(); approve(root, null);
  const destination = path.join(fixture, 'destination');
  fs.cpSync(root, destination, { recursive: true });
  await expect(runChecks(destination, { all: true })).rejects.toThrow(/local execution consent/);
  expect(fs.existsSync(path.join(destination, 'marker'))).toBe(false);
  fs.writeFileSync(path.join(root, 'ordinary-artifact.txt'), 'changed');
  expect(consentStatus(root).valid).toBe(true);
  expect((await runChecks(root, { all: true })).done).toBe(true);
  fs.appendFileSync(path.join(root, 'proof.cjs'), '\n// changed verifier');
  expect(consentStatus(root).valid).toBe(false);
  await expect(runChecks(root, { all: true })).rejects.toThrow(/local execution consent/);
});

it('binds PATH and CWD and gates every check type before adapters can run', async () => {
  prepare(); approve(root, null);
  vi.stubEnv('PATH', `${process.env['PATH']}${path.delimiter}${fixture}`);
  expect(consentStatus(root).valid).toBe(false);
  for (const check of [
    '{ type: file, path: absent, exists: false }',
    '{ type: http, url: "http://127.0.0.1:1/" }',
    '{ type: eval, cases: cases.jsonl, runner: "node proof.cjs", expect: { pass: 1 } }',
    '{ type: review, path: absent, pack: code }',
  ]) {
    const dir = path.join(fixture, `other-${Math.random()}`); fs.mkdirSync(dir);
    draft(dir, '# fixture', `- { id: proof, then: checked, check: ${check} }`);
    // A copied or forged project state is not the external receipt.
    const file = path.join(dir, '.vibe', 'state.json');
    const state = JSON.parse(fs.readFileSync(file, 'utf8')); state.state = 'APPROVED';
    fs.writeFileSync(file, JSON.stringify(state));
    await expect(runChecks(dir)).rejects.toThrow(/local execution consent/);
  }
});

it('rejects malformed/linked receipts and bounded invalid inspection inputs', () => {
  prepare(); const receipt = saveConsent(root);
  fs.writeFileSync(receipt, '{bad');
  expect(consentStatus(root).valid).toBe(false);
  fs.rmSync(receipt);
  if (process.platform === 'win32') fs.linkSync(path.join(root, 'proof.cjs'), receipt);
  else fs.symlinkSync(path.join(root, 'proof.cjs'), receipt);
  expect(consentStatus(root).valid).toBe(false);
  expect(() => saveConsent(root)).toThrow(/linked|regular/);
  fs.writeFileSync(path.join(root, 'bad.yaml'), '- { id: a, then: x, check: { type: unknown } }');
  expect(inspectContract(root, ['.vibe/intent.md', 'bad.yaml']).rejections).not.toHaveLength(0);
  fs.writeFileSync(path.join(root, 'large.md'), 'x'.repeat(1_048_577));
  expect(inspectContract(root, ['large.md', 'bad.yaml']).rejections).not.toHaveLength(0);
});

it('a changed resolved working directory invalidates the reviewed plan', () => {
  const first = path.join(root, 'first'); const second = path.join(root, 'second');
  fs.mkdirSync(first); fs.mkdirSync(second);
  const link = path.join(root, 'work');
  fs.symlinkSync(first, link, process.platform === 'win32' ? 'junction' : 'dir');
  draft(root, '# directory binding', '- { id: proof, then: checked, check: { type: run, cmd: "exit 0", cwd: work } }');
  approve(root, null);
  expect(consentStatus(root).valid).toBe(true);
  fs.unlinkSync(link); fs.symlinkSync(second, link, process.platform === 'win32' ? 'junction' : 'dir');
  expect(consentStatus(root)).toMatchObject({ valid: false, changed: ['checks'] });
});

it('preview rejects linked, malformed and oversized configuration without initializing reviewer storage', () => {
  prepare();
  const config = path.join(root, '.vibe/config.json');
  fs.writeFileSync(config, 'x'.repeat(1_048_577));
  expect(() => executionPlan(root)).toThrow(/byte limit/);
  fs.writeFileSync(config, '{bad');
  expect(() => executionPlan(root)).toThrow();
  fs.rmSync(config);
  if (process.platform !== 'win32') {
    fs.symlinkSync(path.join(root, 'proof.cjs'), config);
    expect(() => executionPlan(root)).toThrow(/linked/);
    fs.rmSync(config);
  }
  vi.stubEnv('VIBE_REVIEW_CLIENT', 'claude');
  vi.stubEnv('VIBE_REVIEW_CMD', '');
  const neutral = path.join(fixture, 'neutral');
  vi.stubEnv('VIBE_HOME_DIR', neutral);
  draft(root, '# reviewer context', '- { id: proof, then: reviewed, check: { type: review, path: artifact, pack: code } }');
  const expected = path.join(neutral, '.config/vibe/reader');
  expect(executionPlan(root).checks[0]?.cwd).toBe(expected);
  expect(fs.existsSync(neutral)).toBe(false);
  approve(root, null);
  vi.stubEnv('VIBE_HOME_DIR', path.join(fixture, 'other-neutral'));
  expect(consentStatus(root).valid).toBe(false);
});

it.skipIf(process.platform === 'win32')('preview refuses a FIFO configuration before opening it', () => {
  prepare(); const file = path.join(root, '.vibe/config.json');
  fs.rmSync(file, { force: true }); execFileSync('mkfifo', [file]);
  expect(() => executionPlan(root)).toThrow(/regular file/);
});
