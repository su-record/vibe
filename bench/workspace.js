import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installSurfaces, projectLayout, SKILL_NAMES } from '../dist/install/global.js';

export function agentEnvironment(input) {
  return Object.fromEntries(Object.entries(input).filter(([key]) => !/^VIBE_(KEY|JUDGE)_/.test(key)));
}

export function vibeSync(ws, args, { repo, env }, extra = {}) {
  return spawnSync(process.execPath, [path.join(repo, 'dist/cli.js'), ...args, '--json'], {
    cwd: ws, encoding: 'utf8', input: extra.input, env: { ...env, ...extra.env },
  });
}

function checkedVibe(ws, args, context, extra) {
  const result = vibeSync(ws, args, context, extra);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`vibe ${args.join(' ')} exited ${result.status}: ${result.stderr || result.stdout}`);
  return result;
}

export function approveContract(ws, contractDir, context) {
  const input = JSON.stringify({
    intent: fs.readFileSync(path.join(contractDir, 'intent.md'), 'utf8'),
    scenarios: fs.readFileSync(path.join(contractDir, 'scenarios.yaml'), 'utf8'),
  });
  checkedVibe(ws, ['tokens', 'off'], context);
  checkedVibe(ws, ['intent', 'draft', '--stdin'], context, { input });
  checkedVibe(ws, ['approve'], context);
}

function addSurfaces(ws, clients) {
  for (const client of new Set(clients)) {
    const layout = projectLayout(client === 'claude' ? 'claude' : 'codex');
    installSurfaces(ws, layout);
    const skills = path.join(ws, layout.skills);
    for (const name of fs.readdirSync(skills)) {
      if (!SKILL_NAMES.includes(name)) fs.rmSync(path.join(skills, name), { recursive: true, force: true });
    }
  }
}

export function prepareWorkspace(taskDir, { repo, env, harness, clients }) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), `vibe4-bench-${clients[0]}-${harness}-`));
  const context = { repo, env: agentEnvironment(env) };
  for (const name of fs.readdirSync(taskDir)) {
    if (!['public', 'judge', 'key'].includes(name)) fs.cpSync(path.join(taskDir, name), path.join(ws, name), { recursive: true });
  }
  const prepare = path.join(taskDir, 'judge/prepare.cjs');
  if (fs.existsSync(prepare)) execFileSync(process.execPath, [prepare], {
    cwd: ws, env: { ...context.env, VIBE_BENCH_REPO: repo }, stdio: 'pipe',
  });
  execFileSync('git', ['init', '-q'], { cwd: ws });
  if (harness !== 'off') {
    addSurfaces(ws, clients);
    if (harness === 'on') approveContract(ws, path.join(taskDir, 'public'), context);
    checkedVibe(ws, ['tokens', harness === 'on' ? 'irreversible' : 'off'], context);
  }
  return ws;
}

/** Only the judge's copy receives private grading files. The agent's tree remains evidence. */
export function gradingWorkspace(ws, taskDir) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-judge-'));
  const workspace = path.join(root, 'workspace');
  const home = path.join(root, 'home');
  fs.cpSync(ws, workspace, { recursive: true });
  fs.mkdirSync(home);
  for (const name of ['judge', 'key']) {
    if (fs.existsSync(path.join(taskDir, name))) fs.cpSync(path.join(taskDir, name), path.join(workspace, name), { recursive: true });
  }
  // A submitted test edit must not edit the private grading rule along with the solution.
  for (const name of fs.readdirSync(taskDir)) {
    if (name === 'checks' || /(?:^|\.)test\.[cm]?js$/.test(name)) fs.cpSync(path.join(taskDir, name), path.join(workspace, name), { recursive: true });
  }
  fs.rmSync(path.join(workspace, '.vibe/regressions'), { recursive: true, force: true });
  return { root, workspace, home };
}
