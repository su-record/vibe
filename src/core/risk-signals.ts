import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readPrivate, writePrivate } from './private-store.js';
import { denied } from './errors.js';
import { RISK_KINDS, type Risk } from './verification.js';
import type { Scenario } from './scenarios.js';
import { mutationOf, actionOf } from './checks/mutation.js';

export interface RiskSignal { kind: Risk['kind']; source: 'path' | 'command'; target: string; reason: string }
const SKIP = new Set(['.git', '.vibe', 'node_modules', 'dist', '.venv', '.codex', '.claude']);
const RULES: Array<[Risk['kind'], RegExp]> = [
  ['access', /(?:^|\/)(?:auth(?:entication|orization)?|permissions?|rbac|acl|oauth|consent|tokens?)(?:[./_-]|$)/i],
  ['data', /(?:^|\/)(?:migrations?|schema|prisma)(?:[./_-]|$)|\.sql$/i],
  ['interface', /(?:^|\/)(?:openapi|swagger|proto|graphql)(?:[./_-]|$)|\.(?:proto|graphql)$/i],
  ['deployment', /(?:^|\/)(?:deploy(?:ment)?|terraform|k8s|kubernetes|Dockerfile)(?:[./_-]|$)|^\.github\/workflows\/|\.tf$/i],
  ['integration', /(?:^|\/)(?:connectors?|webhooks?)(?:[./_-]|$)/i],
];
function git(root: string, args: string[], optional = false): string | null {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 2_097_152 });
  if (r.status === 0) return r.stdout;
  if (optional && (!r.error || (r.error as NodeJS.ErrnoException).code === 'ENOENT')) return null;
  throw denied('risk scan could not inspect Git; fix repository access before checking');
}
function baseName(root: string): string { return `risk-base-${createHash('sha256').update(fs.realpathSync(root)).digest('hex')}.json`; }
export function riskBase(root: string): { head: string | null } | null {
  const text = readPrivate(root, baseName(root));
  if (text === null) return null;
  const value = JSON.parse(text);
  if (!value || (value.head !== null && !/^[a-f0-9]{40,64}$/.test(value.head))) throw denied('invalid risk baseline; inspect the task baseline');
  return value;
}
export function captureRiskBase(root: string, newTask: boolean): void {
  if (!newTask && riskBase(root)) return;
  const head = git(root, ['rev-parse', '--verify', 'HEAD'], true)?.trim() ?? null;
  writePrivate(root, baseName(root), JSON.stringify({ head }));
}
function localPaths(root: string): string[] {
  const paths: string[] = [];
  let visited = 0;
  const visit = (rel: string): void => {
    for (const item of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      if (SKIP.has(item.name)) continue;
      const name = rel + item.name;
      visited++;
      if (visited > 20_000) throw denied('risk scan exceeds 20000 paths; narrow the project root');
      if (item.isDirectory()) visit(name + '/');
      else paths.push(name);
    }
  };
  visit('');
  return paths;
}
function changedPaths(root: string): string[] {
  if (git(root, ['rev-parse', '--show-toplevel'], true) === null) {
    if (fs.existsSync(path.join(root, '.git'))) throw denied('risk scan cannot inspect this Git repository; restore Git access before checking');
    return localPaths(root);
  }
  const base = riskBase(root);
  const tracked = base?.head ? git(root, ['diff', '--name-only', '-z', '--no-renames', base.head, '--'])! : git(root, ['ls-files', '-z'])!;
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z'])!;
  return [...new Set((tracked + untracked).split('\0').filter(Boolean))];
}
export function riskRules(root: string): Array<{ prefix: string; kind: Risk['kind'] }> {
  const file = path.join(root, '.vibe', 'risk-rules.json');
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat) return [];
  if (!stat.isFile() || stat.size > 65536) throw denied('risk rules must be a regular JSON file below 64 KiB');
  const rules = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(rules) || rules.length > 100 || rules.some(r => !r || typeof r.prefix !== 'string' || !r.prefix || r.prefix.startsWith('/') || r.prefix.includes('..') || !RISK_KINDS.includes(r.kind))) throw denied('risk rules require project-relative prefix and supported kind');
  return rules;
}
export function pathWithin(file: string, prefix: string): boolean {
  return file === prefix || file.startsWith(prefix.replace(/\/$/, '') + '/');
}
export function riskSignals(root: string, scenarios: Scenario[]): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const custom = riskRules(root);
  for (const file of changedPaths(root)) {
    for (const rule of custom) if (pathWithin(file, rule.prefix)) signals.push({ kind: rule.kind, source: 'path', target: file, reason: 'project path rule' });
    if (/\.(?:md|txt)$|(?:^|\/)(?:tests?|__tests__|fixtures)\/|\.(?:test|spec)\./i.test(file)) continue;
    for (const [kind, pattern] of RULES) if (pattern.test(file)) signals.push({ kind, source: 'path', target: file, reason: 'built-in path rule' });
  }
  for (const s of scenarios) {
    const action = s.irreversible ? actionOf(s.irreversible) : s.check.type === 'run' ? mutationOf(s.check.cmd) : null;
    if (action) signals.push({ kind: ['push', 'publish', 'deploy', 'apply'].includes(action) ? 'deployment' : 'data', source: 'command', target: s.id, reason: `action ${action}` });
    if (s.check.type === 'http' && !['GET', 'HEAD'].includes((s.check.method ?? 'GET').toUpperCase())) signals.push({ kind: 'integration', source: 'command', target: s.id, reason: 'HTTP write method' });
  }
  return signals;
}
export function uncoveredRisks(root: string, scenarios: Scenario[], signals = riskSignals(root, scenarios)): RiskSignal[] {
  return signals.filter(signal => !scenarios.some(s => s.risk?.kind === signal.kind &&
    (signal.source === 'command' ? s.id === signal.target : s.risk.paths?.some(prefix => pathWithin(signal.target, prefix)))));
}
export function requireRiskCoverage(root: string, scenarios: Scenario[]): void {
  const missing = uncoveredRisks(root, scenarios);
  if (missing.length) throw denied(`required risk verification missing: ${JSON.stringify(missing.slice(0, 20))}${missing.length > 20 ? ` (${missing.length} total)` : ''}; connect these outcomes to failure/recovery checks using risk.kind and risk.paths, then draft and approve`);
}
