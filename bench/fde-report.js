#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readLines } from './fde/evidence.js';
import { evaluate } from './fde/release.js';
import { renderReport } from './fde/report.js';
import { writePackets } from './fde/reviews.js';
import { ASSESSMENT_LIMITATION } from './fde/protocol.js';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
try {
  const directory = path.resolve(option('cohort', 'bench/claims/4.1.26'));
  const records = readLines(path.join(directory, 'ledger.jsonl'));
  if (args.includes('--packets')) {
    const output = option('output');
    if (!output) throw new Error('--packets requires a new --output directory for blinded packets');
    console.log(JSON.stringify(writePackets(records, path.resolve(output))));
  } else {
    const protocol = JSON.parse(fs.readFileSync(path.join(directory, 'protocol.json'), 'utf8'));
    const rubric = JSON.parse(fs.readFileSync(new URL('./tasks/work-opportunities/key/requirements.json', import.meta.url), 'utf8'));
    const result = evaluate(protocol, records, rubric.requirements ?? rubric, readLines(path.join(directory, 'ci.jsonl')));
    fs.writeFileSync(path.join(directory, 'results.md'), renderReport(protocol, result));
    console.log(`Evidence report written; release objective ${result.ok ? 'met' : 'unmet'}. No model called.`);
  }
} catch (error) { console.error(`Evidence report failed: ${error.message}`); process.exitCode = 1; }
finally { console.log(ASSESSMENT_LIMITATION); }
