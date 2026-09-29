#!/usr/bin/env node
// Global npm installs synchronize detected clients. If install scripts are disabled,
// `vibe update` or `vibe setup` explicitly repairs integrations; ordinary queries never do.
const isGlobal = process.env.npm_config_global === 'true' || process.env.npm_config_location === 'global';
if (!isGlobal || process.env.VIBE_SKIP_SETUP) process.exit(0);
try {
  const { setupGlobal } = await import('../dist/install/global.js');
  const report = setupGlobal();
  for (const [client, s] of Object.entries(report.surfaces)) {
    process.stdout.write(`vibe: ${client} — card ${s.card} · skills ${s.skills.length} · hook ${s.hook}${s.detail ? ` · ${s.detail}` : ''}\n`);
  }
} catch {
  process.stderr.write('vibe: integration setup incomplete; run `vibe setup` to retry\n');
}
process.exit(0);
