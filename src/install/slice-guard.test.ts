import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { packageRoot } from '../core/paths.js';
import { initializeSliceCounts, readSliceCounts, recordReadTargets } from '../core/read-guard.js';

let fixture: string, root: string, home: string, env: NodeJS.ProcessEnv;
const hash = 'a'.repeat(16);
beforeEach(() => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-slice-'));
  root = path.join(fixture, 'project'); home = path.join(fixture, 'home');
  for (const dir of [home, path.join(root, '.vibe'), path.join(root, 'src'), path.join(root, 'specs'), path.join(root, '.dev')]) fs.mkdirSync(dir, { recursive: true });
  env = { ...process.env, HOME: home, USERPROFILE: home, VIBE_HOME_DIR: home, CODEX_THREAD_ID: '', CLAUDE_SESSION_ID: '', CLAUDE_PROJECT_DIR: root, VIBE_CLIENT: 'codex' };
  fs.writeFileSync(path.join(root, '.vibe/state.json'), JSON.stringify({ state: 'RUNNING', intentHash: hash }));
  for (const name of ['.vibe/intent.md', '.vibe/scenarios.yaml', 'specs/release.md', 'src/selected.ts', 'src/other.ts', '.dev/task.log', 'build.log']) fs.writeFileSync(path.join(root, name), 'first\nsecond\nthird\n');
  expect(recordReadTargets(root, { intentHash: hash, files: ['src/selected.ts'] }, env)).toBe(true);
});
afterEach(() => fs.rmSync(fixture, { recursive: true, force: true }));
function pre(command: string, extra: NodeJS.ProcessEnv = {}, cwd = root) {
  return spawnSync(process.execPath, [path.join(packageRoot(), 'hooks/notify.js'), 'pre'], {
    cwd, env: { ...env, ...extra }, input: JSON.stringify({ cwd, tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8', timeout: 5000,
  });
}

it('blocks slicing files named by state and names cat for Codex; whole files pass', () => {
  for (const command of ["sed -n '1,2p' src/selected.ts", 'head -n 2 src/selected.ts', 'cat src/selected.ts | cut -c1-5', "awk 'NR==2' src/selected.ts"]) {
    const result = pre(command);
    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain('cat (the entire file)');
    expect(result.stderr).not.toContain('Read tool');
  }
  expect(pre('cat src/selected.ts').status).toBe(0);
  expect(pre('cat src/selected.ts').stdout).toBe('');
  expect(pre('head selected.ts', {}, path.join(root, 'src')).status).toBe(2);
  expect(pre('head src/selected.ts', { VIBE_CLIENT: 'claude' }).stderr).toContain('Read tool');
});

it('blocks contracts/specs and file-fed slices, while locating and non-file output pass', () => {
  for (const command of ["grep rules .vibe/intent.md | cut -c1-170", 'head < .vibe/scenarios.yaml', '< specs/release.md head -n 2', 'tail specs/release.md', 'cd specs && head release.md', 'rg -n rules specs/release.md | head']) expect(pre(command).status, command).toBe(2);
  for (const transform of ['nl -ba', 'sort', 'uniq', "tr a-z A-Z"]) expect(pre(`cat specs/release.md | ${transform} | head -n 20`).status, transform).toBe(2);
  for (const command of ['rg -n rules specs/release.md', 'grep -l rules .vibe/intent.md', 'rg -l rules specs | head', 'git diff | head -n 20', 'find specs -type f | head', 'echo "head specs/release.md"', 'tail -n 10 build.log', 'head .dev/task.log > specs/log-copy.md']) {
    const result = pre(command);
    expect(result.status, command).toBe(0);
    expect(result.stdout, command).toBe('');
  }
}, 60_000); // Multiple Node processes run sequentially, also under parallel suite load.

it('warns on every other source/document slice without blocking unrelated commands', () => {
  for (let i = 0; i < 2; i++) {
    const result = pre("sed -n '1,2p' src/other.ts");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.additionalContext).toContain('Partial source/document reading');
  }
  expect(readSliceCounts(root, env)).toEqual({ blocked: 0, warned: 2 });
});

it('counts decisions without raw commands and distinguishes missing measurement from zero', () => {
  expect(readSliceCounts(root, env)).toBeNull();
  expect(initializeSliceCounts(root, env)).toBe(true);
  expect(readSliceCounts(root, env)).toEqual({ blocked: 0, warned: 0 });
  pre('head src/selected.ts'); pre('head src/other.ts'); pre('cat src/selected.ts');
  expect(initializeSliceCounts(root, env)).toBe(true);
  expect(readSliceCounts(root, env)).toEqual({ blocked: 1, warned: 1 });
  const store = path.join(home, '.vibe-runtime');
  const events = fs.readdirSync(store).filter(file => /^slice-[a-f0-9]{64}-/.test(file));
  expect(events).toHaveLength(2);
  for (const file of events) {
    const text = fs.readFileSync(path.join(store, file), 'utf8');
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(['blocked', 'warned']);
    expect(text).not.toContain('head'); expect(text).not.toContain('selected.ts');
  }
  expect(readSliceCounts(root, { HOME: path.join(fixture, 'missing'), USERPROFILE: path.join(fixture, 'missing') })).toBeNull();
});

it('treats stale or unavailable mirrors as unavailable while intrinsic protection remains', () => {
  fs.writeFileSync(path.join(root, '.vibe/state.json'), JSON.stringify({ intentHash: 'b'.repeat(16) }));
  const stale = pre('head src/selected.ts');
  expect(stale.status).toBe(0);
  expect(stale.stdout).toContain('mirror or count storage unavailable');
  expect(pre('head specs/release.md').status).toBe(2);
  expect(recordReadTargets(root, { intentHash: null, files: [] }, env)).toBe(false);
  fs.rmSync(path.join(root, '.vibe'), { recursive: true });
  expect(pre('head specs/release.md').status).toBe(2);
});
