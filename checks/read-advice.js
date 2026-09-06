#!/usr/bin/env node
// The PreToolUse(Read) advice: a long file gets a note naming `vibe read --ask`, a short file gets nothing, both exit 0.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-read-advice-'));
const long = path.join(dir, 'long.ts');
const short = path.join(dir, 'short.ts');
fs.writeFileSync(long, Array.from({ length: 500 }, (_, i) => `const v${i} = ${i};`).join('\n') + '\n');
fs.writeFileSync(short, Array.from({ length: 100 }, (_, i) => `const v${i} = ${i};`).join('\n') + '\n');

function hook(file) {
  const payload = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: file } });
  return spawnSync(process.execPath, ['hooks/notify.js', 'pre'], { input: payload, encoding: 'utf-8', env: { ...process.env, CLAUDE_PROJECT_DIR: process.cwd() } });
}

const a = hook(long);
const b = hook(short);
fs.rmSync(dir, { recursive: true, force: true });
const fail = (msg) => {
  process.stderr.write(`read-advice: ${msg}\n`);
  process.exit(1);
};
if (a.status !== 0 || b.status !== 0) fail(`exit ${a.status} / ${b.status}`);
if (!a.stdout.includes('--ask') || !a.stdout.includes('500 lines')) fail(`long file got no advice: ${a.stdout || '(empty)'}`);
if (b.stdout.trim() !== '') fail(`short file got advice: ${b.stdout}`);
process.stdout.write('read-advice: long file advised, short file silent\n');
