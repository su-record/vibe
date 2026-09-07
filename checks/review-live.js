#!/usr/bin/env node
// Live proof that the design pack judges: the slop fixture must be REJECTed by the first stage,
// with at least two catalogue markers named. Argument: which client CLI reviews (claude | codex).
import { spawnSync } from 'node:child_process';

const client = process.argv[2] === 'codex' ? 'codex' : 'claude';
const cmd = client === 'codex' ? 'codex exec --skip-git-repo-check -' : 'claude -p --output-format text';
const scenario = JSON.stringify({
  id: 'design-fixture',
  then: 'the slop fixture is rejected',
  check: { type: 'review', pack: 'design', path: 'checks/fixtures/slop/index.html', contract: 'checks/fixtures/slop/brief.md', evidence: 'checks/fixtures/slop/evidence.md', timeoutMs: 540000 },
});
const r = spawnSync(process.execPath, ['-e', `
  const { reviewCheck } = await import('./dist/core/checks/review.js');
  const scenario = ${scenario};
  const out = await reviewCheck(scenario.check, process.cwd());
  process.stdout.write(JSON.stringify(out));
`], { encoding: 'utf-8', timeout: 570_000, env: { ...process.env, VIBE_REVIEW_CMD: cmd } });
const fail = (msg) => {
  process.stderr.write(`review-live(${client}): ${msg}\n`);
  process.exit(1);
};
if (r.status !== 0) fail(`the runner exited ${r.status}\n${r.stderr}`);
let out;
try {
  out = JSON.parse(r.stdout);
} catch {
  fail(`no verdict: ${r.stdout.slice(0, 400)}`);
}
if (out.pass) fail(`the fixture passed, which means the reviewer is not judging: ${out.tail}`);
if (!/markup-reviewer/.test(out.reason || '')) fail(`the first stage is not the markup reviewer: ${out.reason}`);
const text = String(out.tail || '').toLowerCase();
const markers = ['gradient', 'emoji', 'glass', 'blur', 'invented', 'fabricat', 'testimonial', 'contrast', 'centre', 'center', 'fade', 'hover', 'welcome back', 'placeholder', 'stat'];
const hit = markers.filter((m) => text.includes(m));
if (hit.length < 2) fail(`the rejection names fewer than two catalogue markers (${hit.join(', ') || 'none'}):\n${out.tail}`);
process.stdout.write(`review-live(${client}): REJECT at ${out.reason}, markers named: ${hit.join(', ')}\n`);
