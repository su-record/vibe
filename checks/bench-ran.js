#!/usr/bin/env node
// The bench is not a claim until it ran: one judged line per arm in bench/ledger.jsonl.
import fs from 'node:fs';
const file = 'bench/ledger.jsonl';
if (!fs.existsSync(file)) {
  console.error('bench/ledger.jsonl missing — run node bench/run.js for each arm');
  process.exit(1);
}
const lines = fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const arms = new Set(lines.filter((e) => e.event === 'check').map((e) => `${e.client}/${e.harness}`));
const want = ['claude-code/on', 'claude-code/off', 'codex/on', 'codex/off'];
const missing = want.filter((a) => !arms.has(a));
if (missing.length > 0) {
  console.error(`arms without a judged run: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`bench: ${lines.length} judged runs · arms ${[...arms].join(', ')}`);
