#!/usr/bin/env node
// Runs on `npm i -g @su-record/vibe` — puts the card, six skills and the notification hook into every
// client home that exists (~/.claude, ~/.codex). Never fails the install. npm blocks install scripts by
// default, so the same work happens on the first `vibe` command; this only saves that one run.
const isGlobal = process.env.npm_config_global === 'true' || process.env.npm_config_location === 'global';
if (!isGlobal || process.env.VIBE_SKIP_SETUP) process.exit(0);
try {
  const { setupGlobal } = await import('../dist/install/global.js');
  const report = setupGlobal();
  for (const [client, s] of Object.entries(report.surfaces)) {
    process.stdout.write(`vibe: ${client} — card ${s.card} · skills ${s.skills.length} · hook ${s.hook}\n`);
  }
} catch {
  // a development checkout without dist/, or a home we cannot write — the first `vibe` command repairs it
}
process.exit(0);
