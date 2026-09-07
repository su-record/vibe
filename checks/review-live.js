#!/usr/bin/env node
// Live proof that the packs judge through the slim drivers: the design fixture and the code fixture
// are REJECTed at their first stage with at least two catalogue markers named; on Claude the design
// run's input stays under 6,000 tokens (the project context is gone). Argument: claude | codex.
import { spawnSync } from 'node:child_process';

const client = process.argv[2] === 'codex' ? 'codex' : 'claude';
const FIXTURES = [
  { pack: 'design', path: 'checks/fixtures/slop/index.html', contract: 'checks/fixtures/slop/brief.md', evidence: 'checks/fixtures/slop/evidence.md', stage: 'markup-reviewer',
    markers: ['gradient', 'emoji', 'glass', 'blur', 'invented', 'fabricat', 'testimonial', 'contrast', 'centre', 'center', 'fade', 'hover', 'welcome back', 'placeholder', 'stat'] },
  { pack: 'code', path: 'checks/fixtures/slop-code/roster.py', contract: 'checks/fixtures/slop-code/brief.md', evidence: 'checks/fixtures/slop-code/evidence.md', stage: 'reviewer',
    markers: ['except', 'swallow', 'todo', 'comment', 'restat', 'helper', 'manager', 'abstract', 'one implementation', 'single', 'dead', 'commented', 'print', 'logging', 'generic', 'something went wrong', 'robust', 'config', 'docstring'] },
];
const fail = (msg) => {
  process.stderr.write(`review-live(${client}): ${msg}\n`);
  process.exit(1);
};
const lines = [];
for (const f of FIXTURES) {
  const check = { type: 'review', pack: f.pack, path: f.path, contract: f.contract, timeoutMs: 540000, ...(f.evidence ? { evidence: f.evidence } : {}) };
  const r = spawnSync(process.execPath, ['-e', `
    const { reviewCheck } = await import('./dist/core/checks/review.js');
    const out = await reviewCheck(${JSON.stringify(check)}, process.cwd());
    process.stdout.write(JSON.stringify(out));
  `], { encoding: 'utf-8', timeout: 570_000, env: { ...process.env, VIBE_REVIEW_CLIENT: client, VIBE_REVIEW_CMD: '' } });
  if (r.status !== 0) fail(`${f.pack}: the runner exited ${r.status}\n${r.stderr}`);
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    fail(`${f.pack}: no verdict: ${r.stdout.slice(0, 400)}`);
  }
  if (out.pass) fail(`${f.pack}: the fixture passed, which means the reviewer is not judging: ${out.tail}`);
  if (!out.reason || !out.reason.startsWith(f.stage)) fail(`${f.pack}: the first stage is not ${f.stage}: ${out.reason}`);
  const text = String(out.tail || '').toLowerCase();
  const hit = f.markers.filter((m) => text.includes(m));
  if (hit.length < 2) fail(`${f.pack}: the rejection names fewer than two catalogue markers (${hit.join(', ') || 'none'}):\n${out.tail}`);
  const usage = (out.usage || [])[0];
  if (client === 'claude' && f.pack === 'design') {
    if (!usage) fail('design: no usage reported by the claude driver');
    if (usage.input + usage.cacheRead + usage.cacheWrite >= 6000) fail(`design: the reviewer's context is ${usage.input + usage.cacheRead + usage.cacheWrite} tokens — the project context is still there`);
  }
  lines.push(`${f.pack}: REJECT at ${f.stage}, markers ${hit.join(', ')}${usage ? ` · tokens in ${usage.input + usage.cacheRead + usage.cacheWrite}` : ''}`);
}
process.stdout.write(`review-live(${client}): ${lines.join(' | ')}\n`);
