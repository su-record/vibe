#!/usr/bin/env node
// On Windows CI: `vibe read --ask` through a fake `claude.cmd` on PATH — the quoted empty arguments must
// reach the driver, and the reply must come back. Runs on any platform; writes the shim it needs.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-win-read-'));
const script = path.join(bin, 'fake-claude.js');
fs.writeFileSync(script, `
  const a = process.argv.slice(2);
  if (a[0] === '--version') { process.stdout.write('1.0.0\\n'); process.exit(0); }
  require('fs').readFileSync(0, 'utf-8');
  const tools = a[a.indexOf('--tools') + 1];
  const ok = tools === '' && a.includes('--disable-slash-commands');
  process.stdout.write(JSON.stringify({ session_id: 's', result: ok ? 'ARGS-OK' : 'ARGS-BAD ' + JSON.stringify(a), usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 } }));
`);
if (process.platform === 'win32') fs.writeFileSync(path.join(bin, 'claude.cmd'), `@echo off\r\nnode "${script}" %*\r\n`);
else fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh\nexec node "${script}" "$@"\n`, { mode: 0o755 });
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-win-home-'));
const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, VIBE_HOME_DIR: home, VIBE_SKIP_SETUP: '1' };
const r = spawnSync(process.execPath, [path.join(process.cwd(), 'dist', 'cli.js'), 'read', 'package.json', '--ask', 'what is the name?', '--json'], { encoding: 'utf-8', env });
let reply = '';
try {
  reply = JSON.parse(r.stdout).reply;
} catch {
  /* no json */
}
fs.rmSync(bin, { recursive: true, force: true });
fs.rmSync(home, { recursive: true, force: true });
if (reply !== 'ARGS-OK') {
  process.stderr.write(`win-read: the reader driver's arguments did not survive the shell: exit ${r.status}\n${r.stdout}\n${r.stderr}`);
  process.exit(1);
}
process.stdout.write('win-read: the reader driver reached the fake claude with its empty arguments intact\n');
