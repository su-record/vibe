#!/usr/bin/env node
// `vibe profile` must name the three things the anomaly task hides: the repeated order id, the refund, the euro row.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = execFileSync('node', ['dist/cli.js', 'profile', 'bench/tasks/anomaly/orders.csv', '--json'], { cwd: root, encoding: 'utf-8', env: { ...process.env, VIBE_SKIP_SETUP: '1' } });
const profile = JSON.parse(out.replace(/^[^{]*/, ''));
const wanted = [/"order_id" repeats: 1 of/, /"amount" has 1 negative value/, /"currency" is "EUR" in only 1 of/];
const missing = wanted.filter((re) => !profile.anomalies.some((a) => re.test(a)));
if (missing.length) {
  console.error(`vibe profile does not name: ${missing.map(String).join(', ')}\n  got: ${profile.anomalies.join(' | ')}`);
  process.exit(1);
}
console.log(`anomaly-profile: ${profile.anomalies.length} anomalies named — ${profile.anomalies.join(' · ')}`);
