import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const excluded = new Set(['.git', 'node_modules', '.claude', '.codex', '.agents']);

function filesIn(root, relative = '') {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    if (excluded.has(entry.name)) return [];
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) return filesIn(root, name);
    return entry.isFile() ? [name] : [];
  });
}

export function treeManifest(root) {
  return Object.fromEntries(filesIn(root).map((name) => [name, digest(fs.readFileSync(path.join(root, name)))]));
}

/** Exact source and check bytes live outside the agent workspace, under their manifest hash. */
export function freezeScope(ws, reason = 'approved') {
  const manifest = treeManifest(ws);
  const hash = digest(JSON.stringify(manifest));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-scope-'));
  for (const name of Object.keys(manifest)) {
    const destination = path.join(directory, 'files', name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(ws, name), destination);
  }
  const snapshot = { hash, path: directory, at: new Date().toISOString(), reason, manifest };
  fs.writeFileSync(path.join(directory, 'snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}

export function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function agentEvidence(ws) {
  const state = readJson(path.join(ws, '.vibe/state.json'), {});
  const results = readJson(path.join(ws, '.vibe/results.json'), {});
  const ledgerFile = path.join(ws, '.vibe/ledger.jsonl');
  const events = fs.existsSync(ledgerFile) ? fs.readFileSync(ledgerFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
  const check = events.filter((event) => event.event === 'check').at(-1);
  const scenariosFile = path.join(ws, '.vibe/scenarios.yaml');
  const scenarios = fs.existsSync(scenariosFile) ? YAML.parse(fs.readFileSync(scenariosFile, 'utf8')) ?? [] : [];
  const regDir = path.join(ws, '.vibe/regressions');
  return {
    scoped: { scenarios: scenarios.length, checks: [...new Set(scenarios.map((s) => s.check?.type).filter(Boolean))], approved: Boolean(state.approvedAt) },
    verification: { state: state.state ?? 'NONE', passed: check?.passed ?? null, failed: check?.failed ?? null, results, at: check?.at ?? null },
    regressions: fs.existsSync(regDir) ? fs.readdirSync(regDir).filter((name) => name.endsWith('.yaml')).length : 0,
    sideUsage: events.filter((event) => event.event === 'usage' && event.tokens),
  };
}
