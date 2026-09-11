import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { draft, approve } from './intent.js';
import { runChecks, invalidateDoneIfEdited } from './check.js';
import { riskSignals, uncoveredRisks } from './risk-signals.js';
import { parseScenarios } from './scenarios.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-signals-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const simple = '- { id: ok, then: checked, check: {type: run, cmd: "node -e 0"} }';
const git = (...args: string[]) => execFileSync('git', args, {cwd:root, stdio:'ignore'});
function repo() { git('init', '-q'); git('-c','user.email=t@t','-c','user.name=t','commit','--allow-empty','-qm','base'); }
function write(file: string, text = 'x') { fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true}); fs.writeFileSync(path.join(root,file),text); }
function start(text = simple) { expect(draft(root,'# Fixture',text).ok).toBe(true); approve(root,null); }

it('blocks undeclared auth edits, including edits committed after the task baseline', async () => {
  repo(); start(); write('src/auth.ts');
  await expect(runChecks(root)).rejects.toThrow(/required risk verification missing.*access/);
  git('add','src/auth.ts'); git('-c','user.email=t@t','-c','user.name=t','commit','-qm','auth');
  await expect(runChecks(root)).rejects.toThrow(/src\/auth.ts/);
  expect(fs.existsSync(path.join(root,'.vibe/evidence/r-1.json'))).toBe(false);
});

it('detects deleted, staged, untracked and renamed paths including spaces', () => {
  repo(); write('auth/old name.ts'); git('add','auth'); git('-c','user.email=t@t','-c','user.name=t','commit','-qm','before'); start();
  fs.renameSync(path.join(root,'auth/old name.ts'),path.join(root,'plain.ts')); git('add','-A');
  write('migrations/new.sql');
  const paths = riskSignals(root, []).map(s=>s.target);
  expect(paths).toContain('auth/old name.ts'); expect(paths).toContain('migrations/new.sql');
});

it('requires coverage for the detected path, not an unrelated declaration of the same kind', async () => {
  repo(); write('src/auth.ts'); write('proof.txt','safe');
  const text = JSON.stringify([
    {id:'proof',then:'fixture preserved',check:{type:'file',path:'proof.txt',contains:'safe'}},
    {id:'ok',then:'checked',risk:{kind:'access',paths:['other'],impact:'tenant boundary',recovery:'disable route',failureChecks:['proof'],recoveryChecks:['proof']},check:{type:'run',cmd:'node -e 0'}},
  ]);
  start(text); await expect(runChecks(root)).rejects.toThrow(/required risk verification missing/);
  start(text.replace('"other"','"src/auth.ts"'));
  expect((await runChecks(root)).done).toBe(true);
  write('auth/new.ts'); expect(invalidateDoneIfEdited(root)).toBe(true);
  await expect(runChecks(root)).rejects.toThrow(/auth\/new.ts/);
});

it('rechecks signals after a check creates a risky file and never records DONE', async () => {
  repo(); write('writer.cjs', "require('fs').writeFileSync('auth.ts','changed');");
  start('- {id: write, then: output, check: {type: run, cmd: node writer.cjs}}');
  await expect(runChecks(root)).rejects.toThrow(/auth.ts/);
  expect(JSON.parse(fs.readFileSync(path.join(root,'.vibe/state.json'),'utf8')).state).not.toBe('DONE');
});

it('finds commands and HTTP writes without risk declarations; ordinary edits need no extra gate', async () => {
  const parsed = parseScenarios('- {id: ship, then: shipped, check: {type: run, cmd: npm publish}}\n- {id: send, then: sent, check: {type: http, method: POST, url: "http://localhost/"}}');
  expect(uncoveredRisks(root, parsed.scenarios).map(s=>s.kind)).toEqual(['deployment','integration']);
  repo(); start(); write('src/math.ts'); write('docs/auth.md'); write('tests/auth.test.ts');
  expect((await runChecks(root)).done).toBe(true);
});

it('uses additive project rules and conservatively inspects non-Git projects', () => {
  write('custom/handler.ts'); write('auth.ts');
  write('.vibe/risk-rules.json', JSON.stringify([{prefix:'custom',kind:'integration'}]));
  expect(riskSignals(root, []).map(s=>s.kind).sort()).toEqual(['access','integration']);
  write('.vibe/risk-rules.json','{"disable":true}');
  expect(()=>riskSignals(root,[])).toThrow(/risk rules/);
});
