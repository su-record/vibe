#!/usr/bin/env node
// Live proof through a client CLI: the first ask answers from the files, the second resumes the reader
// session and reads the corpus from cache. Argument: which client reads (claude | codex).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const client = process.argv[2] === 'codex' ? 'codex' : 'claude';
const files = ['src/core/skills.ts', 'src/core/regress.ts'];
// For the Codex run, hide `claude` from PATH so the reader falls through to Codex, and use a fresh
// session index so the first ask is really a first ask.
const home = client === 'codex' ? fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-read-live-')) : null;
let env = { ...process.env };
if (client === 'codex') {
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin);
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (fs.existsSync(path.join(dir, 'claude'))) fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  }
  env = { ...env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, VIBE_HOME_DIR: home };
}
function ask(question) {
  const r = spawnSync(process.execPath, ['dist/cli.js', 'read', ...files, '--ask', question, '--json'], { encoding: 'utf-8', timeout: 300_000, env });
  if (r.status !== 0) {
    process.stderr.write(`read-live: exit ${r.status}\n${r.stderr}${r.stdout}`);
    process.exit(1);
  }
  return JSON.parse(r.stdout);
}
const fail = (msg) => {
  process.stderr.write(`read-live(${client}): ${msg}\n`);
  process.exit(1);
};
const first = ask('Which exported function of src/core/regress.ts creates the regression file? Give its name and the line where it is declared, in one line.');
if (client === 'claude' && !/recordRegression/i.test(first.reply)) fail(`first reply does not name recordRegression: ${first.reply}`);
const second = ask('Which function decides the regression id? One line.');
if (!second.session.resumed) fail(`second run did not resume (session ${JSON.stringify(second.session)})`);
if (!(second.usage && second.usage.cacheRead > 0)) fail(`second run read nothing from cache: ${JSON.stringify(second.usage)}`);
process.stdout.write(`read-live(${client}): first ${first.session.resumed ? 'resumed' : 'new'} · second resumed (${second.usage.cacheRead} read) · "${second.reply.slice(0, 80)}"\n`);
if (home) fs.rmSync(home, { recursive: true, force: true });
