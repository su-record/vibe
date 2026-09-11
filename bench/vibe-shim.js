// An approval returns to the agent only after its exact scope has been captured.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { freezeScope } from './snapshot.js';
import { findProjectRoot } from '../dist/core/paths.js';

const [cli, ...args] = process.argv.slice(2);
if (!cli) throw new Error('bench vibe shim requires the product CLI path');
const result = spawnSync(process.execPath, [cli, ...args], { stdio: ['inherit', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (result.error) throw result.error;
if (args[0] === 'approve' && result.status === 0 && process.env.VIBE_BENCH_SNAPSHOTS) {
  const workspace = findProjectRoot(process.cwd());
  const snapshot = freezeScope(workspace);
  fs.mkdirSync(path.dirname(process.env.VIBE_BENCH_SNAPSHOTS), { recursive: true });
  fs.appendFileSync(process.env.VIBE_BENCH_SNAPSHOTS, `${JSON.stringify({ workspace, ...snapshot })}\n`);
}
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
process.exit(result.status ?? 1);
