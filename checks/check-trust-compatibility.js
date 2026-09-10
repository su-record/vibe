#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLines } from '../bench/fde/evidence.js';
import { compatibility, readinessCause } from '../bench/fde/readiness.js';
import { contentSummary } from '../bench/fde/privacy.js';

const args = process.argv.slice(2), repo = fileURLToPath(new URL('..', import.meta.url));
try {
  if (args.includes('--self-test')) await (await import('./check-trust-compatibility-self-test.js')).selfTest();
  else {
    const index = args.indexOf('--ci'), file = index >= 0 ? path.resolve(args[index + 1]) : path.join(repo, 'bench/claims/4.1.26/ci.jsonl');
    console.log(`check-trust compatibility: exact candidate CI and migration boundaries passed for ${compatibility(repo, readLines(file))}`);
  }
} catch (error) { console.error(JSON.stringify({ errorCode: 'CHECK_TRUST_COMPATIBILITY_FAILED', cause: readinessCause(error), details: contentSummary(error.message) })); process.exitCode = 1; }
