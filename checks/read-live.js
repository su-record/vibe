#!/usr/bin/env node
// Live proof through the claude CLI: the first ask answers from the files, the second resumes the reader session and reads the corpus from cache.
import { spawnSync } from 'node:child_process';

const files = ['src/core/skills.ts', 'src/core/regress.ts'];
function ask(question) {
  const r = spawnSync(process.execPath, ['dist/cli.js', 'read', ...files, '--ask', question, '--json'], { encoding: 'utf-8', timeout: 240_000 });
  if (r.status !== 0) {
    process.stderr.write(`read-live: exit ${r.status}\n${r.stderr}${r.stdout}`);
    process.exit(1);
  }
  return JSON.parse(r.stdout);
}
const fail = (msg) => {
  process.stderr.write(`read-live: ${msg}\n`);
  process.exit(1);
};
const first = ask('Which exported function of src/core/regress.ts creates the regression file? Give its name and the line where it is declared, in one line.');
if (!/recordRegression/i.test(first.reply)) fail(`first reply does not name recordRegression: ${first.reply}`);
const second = ask('Which function decides the regression id? One line.');
if (!second.session.resumed) fail(`second run did not resume (session ${JSON.stringify(second.session)})`);
if (!(second.usage && second.usage.cacheRead > 0)) fail(`second run read nothing from cache: ${JSON.stringify(second.usage)}`);
process.stdout.write(`read-live: first ${first.session.resumed ? 'resumed' : 'new'} (${first.usage.cacheWrite} written, ${first.usage.cacheRead} read) · second resumed (${second.usage.cacheRead} read) · "${second.reply.slice(0, 80)}"\n`);
