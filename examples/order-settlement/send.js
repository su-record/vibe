#!/usr/bin/env node
// Send the settlement sheet to accounting. The real send is irreversible, so the scenario that
// runs it is marked `irreversible: send` and the model must hold a human token before dropping
// --dry-run. Here the "send" is a copy into outbox/ so the example stays self-contained.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const sheet = path.join(here, 'out', 'settlement.csv');
if (!fs.existsSync(sheet)) {
  console.error('no settlement sheet — run settle.js first');
  process.exit(1);
}
if (process.argv.includes('--dry-run')) {
  console.log(`would send ${path.relative(process.cwd(), sheet)} to accounting@example.com`);
  process.exit(0);
}
fs.mkdirSync(path.join(here, 'outbox'), { recursive: true });
fs.copyFileSync(sheet, path.join(here, 'outbox', `settlement-${new Date().toISOString().slice(0, 10)}.csv`));
console.log('sent');
