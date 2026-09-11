import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { packageRoot, vibePath } from './paths.js';
import { usage } from './errors.js';

const MAX_BYTES = 1_048_576;

export function summarizeRuns(runs: unknown[]) {
  const checks = new Map<string, { id: string; executions: number; passed: number; totalMs: number; outputBytes: number }>();
  let skipped = 0;
  for (const run of runs) {
    if (!run || typeof run !== 'object' || !('results' in run) || !Array.isArray(run.results)) { skipped++; continue; }
    for (const result of run.results) {
      if (!result || typeof result.id !== 'string' || !['pass', 'fail'].includes(result.status) || !Number.isFinite(result.ms) || result.ms < 0) continue;
      const row = checks.get(result.id) ?? { id: result.id, executions: 0, passed: 0, totalMs: 0, outputBytes: 0 };
      row.executions++;
      row.passed += Number(result.status === 'pass');
      row.totalMs += result.ms;
      for (const stream of ['stdout', 'stderr']) {
        const bytes = result.capture?.[stream]?.bytes;
        if (Number.isFinite(bytes) && bytes >= 0) row.outputBytes += bytes;
      }
      checks.set(row.id, row);
    }
  }
  return { runs: runs.length, skipped, checks: [...checks.values()].sort((a, b) => b.totalMs - a.totalMs),
    limits: 'Recorded check executions only. Repetition is not proof of wasted work. Summed check duration is not wall time; output bytes are not model tokens. Host tool calls and host tokens are not observed.' };
}

export function performanceReport(root: string) {
  const directory = vibePath(root, 'evidence');
  if (!fs.lstatSync(directory, { throwIfNoEntry: false })?.isDirectory()) return { ...summarizeRuns([]), omitted: 0 };
  const names = fs.readdirSync(directory).filter(name => /^r-\d+\.json$/.test(name)).sort((a, b) => Number(b.slice(2, -5)) - Number(a.slice(2, -5)));
  const selected = names.slice(0, 20);
  const runs = selected.map(name => {
    const file = path.join(directory, name);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.size > MAX_BYTES) return null;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown; }
    catch { return null; }
  });
  return { ...summarizeRuns(runs), omitted: names.length - selected.length };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return (sorted[middle]! + sorted[Math.floor((sorted.length - 1) / 2)]!) / 2;
}

/** Fixed read-only commands: never benchmark an arbitrary shell command or paid model. */
export function benchmarkStartup(root: string) {
  const commands = [['--version'], ['internal', 'brief', '--json'], ['internal', 'guide', 'code', '--json']];
  const results = commands.map(args => {
    const elapsed: number[] = [];
    const bytes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const start = performance.now();
      const run = spawnSync(process.execPath, [path.join(packageRoot(), 'dist', 'cli.js'), ...args], {
        cwd: root, encoding: 'utf8', timeout: 3000, maxBuffer: MAX_BYTES, shell: false,
      });
      if (run.error || run.status !== 0) throw usage(`startup measurement failed: ${args.join(' ')} (${run.error?.message ?? run.status})`);
      if (i >= 2) { elapsed.push(performance.now() - start); bytes.push(Buffer.byteLength(run.stdout) + Buffer.byteLength(run.stderr)); }
    }
    return { command: args.join(' '), samples: elapsed.length, medianMs: median(elapsed), medianOutputBytes: median(bytes) };
  });
  return { node: process.version, platform: process.platform, arch: process.arch, results,
    method: 'Two warmups, ten fresh processes per command, warm filesystem cache. Local CLI latency only; no verdict, model calls or token estimate.' };
}
