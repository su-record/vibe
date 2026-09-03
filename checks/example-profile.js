#!/usr/bin/env node
// The profile of the example orders must surface the two planted anomalies, with their numbers.
import { execFileSync } from 'node:child_process';
const out = JSON.parse(execFileSync('node', ['dist/cli.js', 'profile', 'examples/order-settlement/orders.csv', '--json'], { encoding: 'utf-8' }));
const want = ['1 duplicate rows (identical in every column)', 'column "amount" is missing in 1 of 8 rows'];
const missing = want.filter((w) => !out.anomalies.includes(w));
if (missing.length > 0 || out.rows !== 8) {
  console.error(`profile did not say: ${missing.join(' | ')} (rows ${out.rows})`);
  process.exit(1);
}
console.log(`profile: ${out.rows} rows · anomalies ${out.anomalies.length} · both planted anomalies named`);
