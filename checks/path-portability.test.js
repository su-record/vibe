import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';

let fixture;
const repo = fileURLToPath(new URL('../', import.meta.url));
beforeEach(() => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe path # %-'));
  fs.writeFileSync(path.join(fixture, 'package.json'), '{ "type": "module" }');
});
afterEach(() => fs.rmSync(fixture, { recursive: true, force: true }));

function copy(file) {
  const target = path.join(fixture, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(repo, file), target);
  return target;
}

function run(file, ...args) {
  return spawnSync(process.execPath, [file, ...args], { cwd: fixture, encoding: 'utf8', timeout: 15_000 });
}

it('executes the gate self-test from a path with spaces, a hash and a percent', () => {
  const result = run(copy('checks/bench-gate.js'), '--self-test');
  expect(result.status, result.stdout || result.stderr).toBe(0);
  expect(result.stdout).toContain('bench-gate --self-test: 9 checks passed');
}, 30_000);

it('a gate without evidence fails instead of silently skipping its entry point', () => {
  const result = run(copy('checks/bench-gate.js'));
  expect(result.status, result.stdout || result.stderr).toBe(1);
  expect(result.stdout).toContain('bench gate failed');
  expect(result.stdout).toContain('missing task');
}, 30_000);

it('the settlement example finds its input and dry-run output beside its script', () => {
  const settle = copy('examples/order-settlement/settle.js');
  const send = copy('examples/order-settlement/send.js');
  const here = path.dirname(settle);
  fs.writeFileSync(path.join(here, 'orders.csv'), 'order_id,seller,status,amount\n1,alice,paid,123\n2,alice,refunded,50\n');
  const settled = run(settle);
  expect(settled.status, settled.stdout || settled.stderr).toBe(0);
  expect(JSON.parse(fs.readFileSync(path.join(here, 'out/summary.json'), 'utf8'))).toMatchObject({ sellers: 1, orders: 1, total: 123 });
  const preview = run(send, '--dry-run');
  expect(preview.status, preview.stdout || preview.stderr).toBe(0);
  expect(preview.stdout).toContain('would send');
  expect(fs.existsSync(path.join(here, 'outbox'))).toBe(false);
}, 30_000);
