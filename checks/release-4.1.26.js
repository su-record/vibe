#!/usr/bin/env node
// Read-only release gate: never invokes a client or writes a ledger row.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate } from '../bench/fde/release.js';
import { renderReport } from '../bench/fde/report.js';
import { readLines, digest } from '../bench/fde/evidence.js';
import { treeManifest } from '../bench/snapshot.js';
import { codePins, validateCandidate, ASSESSMENT_LIMITATION } from '../bench/fde/protocol.js';
import { selfTest } from './release-4.1.26-self-test.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(`--${name}`); if (index < 0 || !args[index + 1]) throw new Error(`--${name} is required`); return path.resolve(args[index + 1]); };
function audit(protocol, rows, task) {
  validateCandidate(protocol, repo);
  const actual = codePins(repo, task);
  for (const key of ['runner', 'fixture', 'rubric']) if (actual[key] !== protocol.pins?.[key]) throw new Error(`${key} bytes differ from frozen protocol`);
  for (const row of rows.filter((entry) => entry.event === 'attempt')) {
    for (const snapshot of row.scopeSnapshots ?? []) {
      if (digest(treeManifest(path.join(snapshot.path, 'files'))) !== snapshot.hash) throw new Error(`${row.id}: scope snapshot changed`);
    }
    for (const session of row.sessions ?? []) {
      if (session.invoked === false) continue;
      for (const stream of ['stdout', 'stderr']) if (!fs.existsSync(`${session.log}.${stream}`)) throw new Error(`${row.id}: missing raw ${stream}`);
    }
  }
}

try {
  if (args.includes('--self-test')) selfTest();
  else {
    const file = option('protocol');
    const directory = path.dirname(file);
    const protocol = JSON.parse(fs.readFileSync(file, 'utf8'));
    const rows = readLines(option('ledger'));
    const task = path.join(repo, 'bench/tasks/work-opportunities');
    const rubric = JSON.parse(fs.readFileSync(path.join(task, 'key/requirements.json'), 'utf8'));
    const result = evaluate(protocol, rows, rubric.requirements ?? rubric, readLines(path.join(directory, 'ci.jsonl')));
    if (!result.ok) throw new Error([...result.evidence.problems, ...result.quality.problems, ...result.cost.problems].join('; '));
    audit(protocol, rows, task);
    if (fs.readFileSync(option('report'), 'utf8') !== renderReport(protocol, result)) throw new Error('report is missing, stale or differs from the measured evidence');
    console.log('4.1.26 release evidence passed: complete cohort, per-cell deterministic indicators and per-client cost targets, Linux/Windows CI');
  }
} catch (error) { console.error(`4.1.26 release evidence failed: ${error.message}`); process.exitCode = 1; }
finally { console.log(ASSESSMENT_LIMITATION); }
