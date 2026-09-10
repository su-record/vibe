import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { answer, ask, openQuestions, resolve } from '../dist/core/inbox.js';
import { answerQuestions, stalled } from './dialogue.js';

let ws;
const taskDir = fileURLToPath(new URL('./tasks/anomaly/', import.meta.url));
const meta = JSON.parse(fs.readFileSync(path.join(taskDir, 'judge/meta.json'), 'utf-8'));
const script = path.join(taskDir, meta.fakeUser);
beforeEach(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-dialogue-'));
  fs.writeFileSync(path.join(ws, 'TASK.md'), 'Prepare a settlement.');
});
afterEach(() => fs.rmSync(ws, { recursive: true, force: true }));

describe('the task-owned fake user and stalled attempts', () => {
  it('anomaly gives both sessions the same finance answer through the inbox or final text', () => {
    expect(meta.sessions).toEqual([{}, {}]);
    const { id } = ask(ws, { question: 'How do refunds and EUR work?' });
    expect(answerQuestions(ws, script, '')).toBe(1);
    const text = openQuestions(ws).find((q) => q.id === id).answer;
    expect(text).toContain('docs/finance.md');
    expect(text).toContain('later date');
    expect(text).toContain('not counted as orders');
    expect(text).toContain('1 EUR = 1450 KRW');
    expect(text).toContain('whole won');
    expect(answerQuestions(ws, script, '')).toBe(0); // an answered but unresolved question is not asked again
    expect(answerQuestions(ws, script, 'Please explain the finance rules.')).toBe(1);
    expect(fs.readFileSync(path.join(ws, 'TASK.md'), 'utf-8').split(text)).toHaveLength(3);
  });

  it('answers a bare final message without creating harness state or exposing the key', () => {
    expect(answerQuestions(ws, script, 'What is the EUR rate?')).toBe(1);
    expect(fs.existsSync(path.join(ws, '.vibe'))).toBe(false);
    expect(fs.existsSync(path.join(ws, 'key'))).toBe(false);
    expect(fs.readFileSync(path.join(ws, 'TASK.md'), 'utf-8')).toContain('1450');
  });

  it('counts only unanswered questions with none of the declared outputs', () => {
    expect(stalled(ws, meta.outputs)).toBe(false);
    const { id } = ask(ws, { question: 'What is the rate?' });
    expect(stalled(ws, meta.outputs)).toBe(true);
    fs.mkdirSync(path.join(ws, 'out'));
    fs.writeFileSync(path.join(ws, 'out/summary.json'), '{}');
    expect(stalled(ws, meta.outputs)).toBe(false); // partial or wrong output still has a quality score
    fs.rmSync(path.join(ws, 'out/summary.json'));
    answer(ws, id, '1450');
    expect(stalled(ws, meta.outputs)).toBe(false);
  });

  it('a resolved question and an undeclared output contract are not evidence of a stall', () => {
    const { id } = ask(ws, { question: 'Which rules?' });
    expect(stalled(ws)).toBe(false);
    resolve(ws, id);
    expect(stalled(ws, meta.outputs)).toBe(false);
  });

  it('a fake-user error fails the run instead of looking like an unanswered question', () => {
    const broken = path.join(ws, 'broken.cjs');
    fs.writeFileSync(broken, 'process.exit(7);');
    expect(() => answerQuestions(ws, broken, 'Which rules?')).toThrow('exited 7');
  });

  it.each(['off', 'on', 'scoped', 'stalled'])('the runner records two sessions and pre-judge stall status: %s', (mode) => {
    const bin = path.join(ws, 'bin');
    fs.mkdirSync(bin);
    const fake = path.join(bin, 'claude.cjs');
    fs.writeFileSync(fake, `
const fs = require('node:fs');
const args = process.argv.slice(2);
const prompt = process.platform === 'win32' ? fs.readFileSync(0, 'utf8') : args[args.indexOf('-p') + 1];
if (prompt !== fs.readFileSync('TASK.md', 'utf8')) process.exit(9);
const sources = process.env.DIALOGUE_TEST_MODE === 'off' ? '' : 'project,local';
if (args[args.indexOf('--setting-sources') + 1] !== sources) process.exit(10);
const first = !fs.existsSync('.session-one');
const stalled = process.env.DIALOGUE_TEST_MODE === 'stalled';
if (first) {
  fs.writeFileSync('.session-one', '');
  if (process.env.DIALOGUE_TEST_MODE === 'scoped') {
    const result = require('node:child_process').spawnSync(process.execPath, [process.env.DIALOGUE_TEST_CLI, 'intent', 'draft', '--stdin'], {
      input: JSON.stringify({ intent: '# Settlement\\n', scenarios: '- { id: output, then: summary exists, check: { type: file, path: out/summary.json, exists: true } }\\n' }), encoding: 'utf8'
    });
    if (result.status !== 0) process.exit(result.status);
  }
} else {
  if (!fs.readFileSync('TASK.md', 'utf8').includes('1 EUR = 1450 KRW')) process.exit(8);
  if (stalled) {
    fs.mkdirSync('.vibe', { recursive: true });
    fs.appendFileSync('.vibe/inbox.jsonl', JSON.stringify({ type: 'question', id: 'late', question: 'Which rounding?', at: new Date().toISOString() }) + '\\n');
  } else {
    fs.mkdirSync('out', { recursive: true });
    fs.writeFileSync('out/settlement.csv', 'seller,orders,total\\n');
    fs.writeFileSync('out/summary.json', '{}');
  }
}
console.log(JSON.stringify({ type: 'result', result: first ? 'Which finance rules?' : stalled ? 'Which rounding?' : 'Files written.', num_turns: 1, total_cost_usd: 0, modelUsage: { fixture: { inputTokens: 1, outputTokens: 1 } } }));
`);
    if (process.platform === 'win32') fs.writeFileSync(path.join(bin, 'claude.cmd'), `@echo off\r\n"${process.execPath}" "${fake}" %*\r\n`);
    else fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh\nexec "${process.execPath}" "${fake}" "$@"\n`, { mode: 0o755 });
    const ledger = path.join(ws, 'result.jsonl');
    const root = fileURLToPath(new URL('../', import.meta.url));
    const result = spawnSync(process.execPath, [path.join(root, 'bench/run.js'), '--task', 'anomaly', '--harness', mode === 'stalled' ? 'on' : mode, '--client', 'claude', '--runs', '1', '--ledger', ledger], {
      encoding: 'utf-8', env: { ...process.env, HOME: ws, USERPROFILE: ws, VIBE_HOME_DIR: ws, PATH: `${bin}${path.delimiter}${process.env.PATH}`, DIALOGUE_TEST_MODE: mode, DIALOGUE_TEST_CLI: path.join(root, 'dist/cli.js') }, timeout: 60_000,
    });
    expect(result.status, result.stderr).toBe(0);
    const line = JSON.parse(fs.readFileSync(ledger, 'utf-8'));
    expect(line.sessions).toBe(2);
    expect(line.asked).toBe(1);
    expect(line.stalled ?? false).toBe(mode === 'stalled');
    if (mode === 'stalled') expect(line.armPassed).toBe(false);
    if (mode === 'scoped') expect(line.scoped.approvals).toBe(1);
    fs.rmSync(line.workspace, { recursive: true, force: true });
  }, 60_000);
});
