#!/usr/bin/env node
// Paid cohort entry point. Ordinary checks import validators and never call this module.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { protocolDraft, protocolErrors, settingsFromSources } from './fde/protocol.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const task = path.join(repo, 'bench/tasks/work-opportunities');
const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(`--${name}`); return index < 0 ? fallback : args[index + 1]; };
const protocolFile = path.resolve(option('protocol', path.join(repo, 'bench/claims/4.1.26/protocol.json')));
if (args.includes('--draft')) {
  if (fs.existsSync(protocolFile)) throw new Error('protocol already exists; review it rather than overwrite a possible frozen cohort');
  fs.mkdirSync(path.dirname(protocolFile), { recursive: true });
  fs.writeFileSync(protocolFile, `${JSON.stringify(protocolDraft(repo, task, settingsFromSources(process.env, os.homedir())), null, 2)}\n`, { flag: 'wx' });
  console.log(`Draft only: ${protocolFile}. No model called.`);
} else {
  const protocol = JSON.parse(fs.readFileSync(protocolFile, 'utf8'));
  if (!args.includes('--execute')) {
    const missing = protocolErrors(protocol);
    console.log(JSON.stringify({ planned: protocol.schedule?.length, missing, paidCalls: 0 }, null, 2));
  } else {
    const approvalFile = option('authorization');
    const baseline = option('baseline');
    const output = option('output');
    if (!approvalFile || !baseline || !output) throw new Error('--execute requires --authorization, --baseline and a durable --output directory');
    const approval = JSON.parse(fs.readFileSync(approvalFile, 'utf8'));
    const { runCohort } = await import('./fde/cohort.js');
    await runCohort({ protocol, approval, repo, task, baseline: path.resolve(baseline), output: path.resolve(output),
      ledger: path.join(path.dirname(protocolFile), 'ledger.jsonl') });
  }
}
