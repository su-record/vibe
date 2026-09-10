import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let fixture: string;
let root: string;
let home: string;
const cli = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
const intent = '# A local report\n\n## Why\nUse observed facts to prepare a local draft.\n';
const scenarios = '- { id: report, then: the local report exists, check: { type: file, path: report.txt, exists: true } }\n';

beforeEach(() => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-agreement-cli-'));
  root = path.join(fixture, 'project');
  home = path.join(fixture, 'home');
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  fs.mkdirSync(home);
});
afterEach(() => fs.rmSync(fixture, { recursive: true, force: true }));

function run(args: string[], input?: object) {
  const result = spawnSync(process.execPath, [cli, ...args, '--json'], {
    cwd: root, encoding: 'utf-8', timeout: 60_000,
    input: input === undefined ? undefined : JSON.stringify(input),
    env: { ...process.env, HOME: home, USERPROFILE: home, VIBE_SKIP_SETUP: '1', VIBE_NO_PLUGIN: '1' },
  });
  expect(result.error).toBeUndefined();
  return result;
}

function ok(args: string[], input?: object) {
  const result = run(args, input);
  expect(result.status, result.stdout || result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

describe('CLI agreement and source reuse', () => {
  it('a clear request needs no interview and unchanged sources keep the approved hash', () => {
    fs.writeFileSync(path.join(root, 'facts.md'), 'Observed facts\n');
    const draft = ok(['intent', 'draft', '--stdin'], { intent, scenarios, sources: ['facts.md'] });
    expect(ok(['approve'])).toMatchObject({ hash: draft.hash, basis: 'chat' });
    for (let read = 0; read < 2; read++) {
      expect(ok(['intent', 'show'])).toMatchObject({ sourceBasis: { valid: true, sources: [{ path: 'facts.md', status: 'unchanged' }] } });
      expect(ok(['state'])).toMatchObject({ state: 'APPROVED', intent: { hash: draft.hash }, inbox: { open: 0 } });
    }
    expect(fs.existsSync(path.join(fixture, '.vibe'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.vibe'))).toBe(false);
  }, 60_000);

  it('a defaulted unanswered decision blocks approval; an answer resumes scope before building', () => {
    ok(['intent', 'draft', '--stdin'], { intent, scenarios });
    const question = ok(['ask', 'Which priority?', '--options', 'status|followup', '--default', 'status']);
    const blocked = run(['approve']);
    expect(blocked.status, blocked.stdout || blocked.stderr).toBe(3);
    expect(blocked.stdout).toContain('defaults are not agreement');
    expect(ok(['state'])).toMatchObject({ state: 'DRAFT', stage: 'scope' });
    ok(['inbox', 'answer', question.id, 'followup']);
    const resumed = ok(['state']);
    expect(resumed.next).toContain('continue scope with vibe-scope');
    expect(resumed.next).not.toContain('continue building');
    expect(ok(['approve'])).toMatchObject({ state: 'APPROVED', basis: 'chat' });
  }, 60_000);

  it('source changes require a fresh draft, including positional sources, and missing approved inputs block checks', () => {
    const file = path.join(root, 'facts.md');
    fs.writeFileSync(file, 'original facts');
    const original = ok(['intent', 'draft', '--stdin'], { intent, scenarios, sources: ['facts.md'] });
    fs.writeFileSync(file, 'updated facts');
    expect(ok(['intent', 'show'])).toMatchObject({ sourceBasis: { valid: false, changed: ['facts.md'] } });
    const rejected = run(['approve']);
    expect(rejected.status, rejected.stdout || rejected.stderr).toBe(3);
    expect(rejected.stdout).toContain('facts.md');
    fs.writeFileSync(path.join(root, 'intent-input.md'), `${intent}\nRe-evaluated updated facts.\n`);
    fs.writeFileSync(path.join(root, 'scenario-input.yaml'), scenarios);
    const refreshed = ok(['intent', 'draft', 'intent-input.md', 'scenario-input.yaml', '--sources', 'facts.md']);
    expect(refreshed.hash).not.toBe(original.hash);
    ok(['approve']);
    fs.rmSync(file);
    expect(ok(['intent', 'show'])).toMatchObject({ sourceBasis: { valid: false, missing: ['facts.md'] } });
    const check = run(['check', '--all']);
    expect(check.status, check.stdout || check.stderr).toBe(4);
    expect(check.stdout).toContain('facts.md');
    expect(fs.existsSync(path.join(root, '.vibe/evidence/r-1.json'))).toBe(false);
  }, 60_000);

  it('a strict approval token fulfills only its matching approval question', () => {
    ok(['tokens', 'strict']);
    ok(['intent', 'draft', '--stdin'], { intent, scenarios });
    const request = ok(['ask', 'Approve the local scope?', '--needs', 'approve']);
    const decision = ok(['ask', 'Which review format?', '--default', 'text']);
    expect(run(['approve', request.token]).status).toBe(3);
    ok(['inbox', 'answer', decision.id, 'text']);
    expect(ok(['approve', request.token])).toMatchObject({ state: 'APPROVED', basis: 'token' });
    expect(ok(['inbox']).map((question: { id: string }) => question.id)).toEqual([decision.id]);
  }, 60_000);
});
