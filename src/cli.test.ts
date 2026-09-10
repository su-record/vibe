import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installSurfaces, projectLayout } from './install/global.js';

// Every call spawns tsx; under `vibe check` several vitest processes run at once, so 5s is too tight.
vi.setConfig({ testTimeout: 60_000 });

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI_SRC = path.join(here, 'cli.ts');
const TSX = path.join(here, '..', 'node_modules', '.bin', 'tsx');

let root: string;
let fixtureDir: string;
let fixtureHome: string;
beforeEach(() => {
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-cli-'));
  root = path.join(fixtureDir, 'project');
  fixtureHome = path.join(fixtureDir, 'home');
  fs.mkdirSync(root);
  fs.mkdirSync(fixtureHome);
});
afterEach(() => fs.rmSync(fixtureDir, { recursive: true, force: true }));

interface Run {
  status: number;
  stdout: string;
  json: unknown;
}

function vibe(args: string[], input?: string, env: Record<string, string> = {}, cwd: string = root): Run {
  const result = spawnSync(TSX, [CLI_SRC, ...args, '--json'], {
    cwd,
    encoding: 'utf-8',
    input,
    env: { ...process.env, HOME: fixtureHome, VIBE_SKIP_SETUP: '', VIBE_NO_PLUGIN: '1', VIBE_CLIENT: 'test-client', ...env }, // setup uses the fixture home, separate from the project and its records
    timeout: 60000,
  });
  let json: unknown = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    json = null;
  }
  return { status: result.status ?? -1, stdout: result.stdout, json };
}

const HELLO = JSON.stringify({
  intent: '# Hello\n\n## Why\ntest\n',
  scenarios: '- { id: hello, then: hello.txt exists, check: { type: file, path: hello.txt, contains: "hi" } }\n',
});

describe('CLI — from request to DONE', () => {
  it('strict: tokens → draft → approve(token) → check → DONE; the exit code is the verdict', () => {
    // no init: `vibe setup` installs the global surfaces into $HOME (a query never does) and `tokens` seeds .vibe/
    const before = vibe(['state']);
    expect((before.json as { state: string }).state).toBe('NONE');
    expect(fs.existsSync(path.join(root, '.vibe'))).toBe(false); // a read leaves no trace
    expect(fs.existsSync(path.join(fixtureHome, '.claude', 'CLAUDE.md'))).toBe(false); // and repairs nothing
    expect(vibe(['setup']).status).toBe(0);
    expect(fs.readFileSync(path.join(fixtureHome, '.claude', 'CLAUDE.md'), 'utf-8')).toContain('<!-- vibe:start -->');
    expect(fs.existsSync(path.join(fixtureHome, '.claude', 'skills', 'vibe', 'SKILL.md'))).toBe(true);
    expect(fs.readFileSync(path.join(fixtureHome, '.claude', 'settings.json'), 'utf-8')).toContain('hooks/notify.js');
    expect(fs.existsSync(path.join(root, 'CLAUDE.md'))).toBe(false); // nothing in the project itself

    const tokens = vibe(['tokens', 'strict']);
    expect(tokens.status).toBe(0);
    expect((tokens.json as { tokens: string }).tokens).toBe('strict');
    expect(fs.existsSync(path.join(root, '.vibe', 'state.json'))).toBe(true);

    const draft = vibe(['intent', 'draft', '--stdin'], HELLO);
    expect(draft.status).toBe(0);
    const token = (draft.json as { token: string }).token;
    expect(token).toMatch(/^\d{3} \d{3}$/);

    expect(vibe(['check']).status).toBe(4); // before approval
    expect(vibe(['approve']).status).toBe(3); // strict needs the token
    expect(vibe(['approve', '000', '000']).status).toBe(3); // wrong token
    expect(vibe(['approve', token]).status).toBe(0);

    const failing = vibe(['check']);
    expect(failing.status).toBe(1); // file does not exist yet
    expect((failing.json as { state: string }).state).toBe('RUNNING');

    fs.writeFileSync(path.join(root, 'hello.txt'), 'hi\n');
    const passing = vibe(['check']);
    expect(passing.status).toBe(0);
    expect((passing.json as { done: boolean }).done).toBe(true);

    const after = vibe(['state']);
    expect((after.json as { state: string; stage: string }).state).toBe('DONE');
    expect((after.json as { stage: string }).stage).toBe('handoff');
    expect((vibe(['evidence']).json as { run: string }).run).toBe('r-2');
  });

  it('default (off): nothing needs a token; irreversible (opt-in): approve needs none, authorize does; the draft creates .vibe/', () => {
    const draft = vibe(['intent', 'draft', '--stdin'], HELLO);
    expect((draft.json as { token: string | null }).token).toBeNull();
    expect(fs.existsSync(path.join(root, '.vibe', 'scenarios.yaml'))).toBe(true);
    expect((vibe(['ledger']).json as Array<{ event: string }>)[0]?.event).toBe('init');
    const approved = vibe(['approve']);
    expect(approved.status).toBe(0);
    expect((approved.json as { basis: string }).basis).toBe('chat');
    // the default policy is off: an irreversible action asks for no token and authorize records "auto"
    expect((vibe(['ask', 'Send for real?', '--needs', 'authorize:send', '--target', 'x@example.com']).json as { token: string | null }).token).toBeNull();
    expect(vibe(['authorize', '--action', 'send', '--target', 'x@example.com']).status).toBe(0);
    vibe(['tokens', 'irreversible']);

    const ask = vibe(['ask', 'Send to accounting for real?', '--needs', 'authorize:send', '--target', 'acct@example.com']);
    expect(ask.status).toBe(0);
    const token = (ask.json as { token: string }).token;
    expect(token).toMatch(/^\d{3} \d{3}$/);
    expect(vibe(['authorize', '--action', 'send', '--target', 'acct@example.com']).status).toBe(3);
    expect(vibe(['authorize', token, '--action', 'send', '--target', 'other@example.com']).status).toBe(3);
    expect(vibe(['authorize', token, '--action', 'send', '--target', 'acct@example.com']).status).toBe(0);
    expect(vibe(['authorize', token, '--action', 'send', '--target', 'acct@example.com']).status).toBe(3);
  });

  it('off: nothing needs a token and the ledger says auto', () => {
    vibe(['tokens', 'off']);
    vibe(['intent', 'draft', '--stdin'], HELLO);
    expect(vibe(['approve']).status).toBe(0);
    const ask = vibe(['ask', 'Push?', '--needs', 'authorize:push']);
    expect((ask.json as { token: string | null }).token).toBeNull();
    const auth = vibe(['authorize', '--action', 'push']);
    expect(auth.status).toBe(0);
    expect((auth.json as { basis: string }).basis).toBe('auto');
  });

  it('ask: the answer says stop and wait, and the JSON carries wait', () => {
    vibe(['tokens', 'off']);
    vibe(['intent', 'draft', '--stdin'], HELLO);
    vibe(['approve']);
    const asked = vibe(['ask', 'which currency?']);
    expect(asked.status).toBe(0);
    expect(asked.json).toMatchObject({ wait: true });
    expect(vibe(['state']).json).toMatchObject({ next: expect.stringMatching(/^wait — q-.* asked; the user answers; stop and wait/) });
  });

  it('continues across clients — approved under one, checked under another, both in the ledger', () => {
    const as = (client: string, args: string[], input?: string): Run => {
      const result = spawnSync(TSX, [CLI_SRC, ...args, '--json'], { cwd: root, encoding: 'utf-8', input, env: { ...process.env, HOME: fixtureHome, VIBE_SKIP_SETUP: '', VIBE_NO_PLUGIN: '1', VIBE_CLIENT: client }, timeout: 60000 });
      return { status: result.status ?? -1, stdout: result.stdout, json: JSON.parse(result.stdout) };
    };
    fs.mkdirSync(path.join(fixtureHome, '.codex')); // a Codex home is present, so both clients get the surfaces
    as('claude-code', ['setup']);
    as('claude-code', ['intent', 'draft', '--stdin'], HELLO);
    expect(as('claude-code', ['approve']).status).toBe(0);
    fs.writeFileSync(path.join(root, 'hello.txt'), 'hi\n');
    const checked = as('codex', ['check']);
    expect(checked.status).toBe(0);
    expect((checked.json as { done: boolean }).done).toBe(true);
    const ledger = as('chatgpt', ['ledger']).json as Array<{ event: string; client: string }>;
    expect(ledger.find((e) => e.event === 'approve')?.client).toBe('claude-code');
    expect(ledger.find((e) => e.event === 'done')?.client).toBe('codex');
    expect((as('chatgpt', ['state']).json as { state: string }).state).toBe('DONE');
    expect(fs.existsSync(path.join(fixtureHome, '.codex', 'hooks.json'))).toBe(true);
    expect(fs.existsSync(path.join(fixtureHome, '.codex', 'skills', 'vibe-scope', 'SKILL.md'))).toBe(true);
    expect(fs.readFileSync(path.join(fixtureHome, '.codex', 'AGENTS.md'), 'utf-8')).toContain('<!-- vibe:start -->');
  });

  it('the resolved root is visible: state carries root and a notice from a subdirectory; a missing command names the cwd', () => {
    const home = path.join(root, 'home'); // the project is not the home, so the home rule does not apply to it
    fs.mkdirSync(home);
    const env = { HOME: home };
    vibe(['tokens', 'off'], undefined, env);
    vibe(['intent', 'draft', '--stdin'], JSON.stringify({ intent: '# Root\n\n## Why\ntest\n', scenarios: '- { id: gone, then: x, check: { type: run, cmd: "./scripts/nowhere.sh" } }\n' }), env);
    expect(vibe(['approve'], undefined, env).status).toBe(0);
    const sub = path.join(root, 'src', 'deep');
    fs.mkdirSync(sub, { recursive: true });
    const from = spawnSync(TSX, [CLI_SRC, 'state', '--json'], { cwd: sub, encoding: 'utf-8', env: { ...process.env, HOME: home, VIBE_SKIP_SETUP: '1', VIBE_NO_PLUGIN: '1' }, timeout: 60000 });
    const view = JSON.parse(from.stdout) as { root: string; notices: string[] };
    expect(view.root).toBe(root);
    expect(view.notices.some((n) => n.includes('project root is') && n.includes(root))).toBe(true);
    expect(fs.existsSync(path.join(sub, '.vibe'))).toBe(false);
    const checked = vibe(['check', 'gone'], undefined, env);
    expect(checked.status).toBe(1);
    const outcome = (checked.json as { outcomes: Array<{ id: string; exit: number; tail: string }> }).outcomes.find((o) => o.id === 'gone');
    expect(outcome?.exit).toBe(127);
    expect(outcome?.tail).toContain(`command not found — the check ran in ${root}`);
  });

  it('status reports version, the global surfaces and the project; a missing skill is named by status and repaired by setup, not by a query', () => {
    vibe(['setup']);
    vibe(['tokens', 'off']);
    fs.rmSync(path.join(fixtureHome, '.claude', 'skills', 'vibe-prove'), { recursive: true });
    vibe(['state']);
    expect(fs.existsSync(path.join(fixtureHome, '.claude', 'skills', 'vibe-prove', 'SKILL.md'))).toBe(false); // a query repaired nothing
    const status = vibe(['status']);
    expect(status.status).toBe(0);
    expect(status.json).toMatchObject({ version: expect.stringMatching(/^\d+\.\d+\.\d+/), clients: { claude: { card: true, skills: 5, hook: true, current: false } }, project: { vibe: true, state: 'NONE' } });
    expect(vibe(['setup']).status).toBe(0);
    expect(fs.existsSync(path.join(fixtureHome, '.claude', 'skills', 'vibe-prove', 'SKILL.md'))).toBe(true);
  });

  it('uninstall removes the global card, skills and hook, and what an older init left in the project; .vibe stays unless --purge-state', () => {
    // HOME is root; the repository is a directory below it, as on a real machine
    const project = path.join(root, 'project');
    fs.mkdirSync(project);
    const inProject = (args: string[]): Run => {
      const result = spawnSync(TSX, [CLI_SRC, ...args, '--json'], { cwd: project, encoding: 'utf-8', env: { ...process.env, HOME: root, VIBE_SKIP_SETUP: '', VIBE_NO_PLUGIN: '1', VIBE_CLIENT: 'test-client' }, timeout: 60000 });
      return { status: result.status ?? -1, stdout: result.stdout, json: JSON.parse(result.stdout) };
    };
    inProject(['tokens', 'off']);
    // a 4.0.1 `vibe init` left these inside the repository
    installSurfaces(project, projectLayout('claude'));
    fs.writeFileSync(path.join(project, 'CLAUDE.md'), `# Mine\n\n${fs.readFileSync(path.join(project, 'CLAUDE.md'), 'utf-8')}`);
    fs.mkdirSync(path.join(project, '.claude', 'skills', 'my-skill'));

    const out = inProject(['uninstall']);
    expect(out.status).toBe(0);
    const removed = (out.json as { removed: string[] }).removed;
    expect(removed).toContain('CLAUDE.md card');
    expect(removed).toContain(path.join('.claude', 'settings.local.json') + ' hook');
    expect(fs.existsSync(path.join(root, '.claude', 'skills', 'vibe'))).toBe(false);
    expect(fs.existsSync(path.join(root, '.claude', 'CLAUDE.md'))).toBe(false);
    expect(fs.existsSync(path.join(root, '.claude', 'settings.json'))).toBe(false);
    expect(fs.readFileSync(path.join(project, 'CLAUDE.md'), 'utf-8').trim()).toBe('# Mine');
    expect(fs.existsSync(path.join(project, '.claude', 'skills', 'vibe'))).toBe(false);
    expect(fs.existsSync(path.join(project, '.claude', 'skills', 'my-skill'))).toBe(true);
    expect(fs.existsSync(path.join(project, '.claude', 'settings.local.json'))).toBe(false);
    expect(fs.existsSync(path.join(project, '.vibe'))).toBe(true);

    const purged = spawnSync(TSX, [CLI_SRC, 'uninstall', '--purge-state', '--json'], { cwd: project, encoding: 'utf-8', env: { ...process.env, HOME: root, VIBE_SKIP_SETUP: '1', VIBE_NO_PLUGIN: '1' } });
    expect((JSON.parse(purged.stdout) as { removed: string[] }).removed).toEqual(['.vibe/']);
    expect(fs.existsSync(path.join(project, '.vibe'))).toBe(false);
  });

  it('help always exits 0', () => {
    expect(execFileSync(TSX, [CLI_SRC, '--help'], { cwd: root, encoding: 'utf-8', env: { ...process.env, HOME: fixtureHome } })).toContain('vibe');
  });
});

describe('graph — edges the ledger can walk', () => {
  const GRAPH = JSON.stringify({
    intent: '# Graph\n\n## Why\nedges\n',
    scenarios: [
      '- { id: build, then: out exists, check: { type: run, cmd: "echo x > out.txt" } }',
      '- { id: tests, needs: [build], then: out has x, check: { type: file, path: out.txt, contains: x } }',
      '',
    ].join('\n'),
  });

  it('state --graph prints mermaid with one node per scenario and one edge per needs entry', () => {
    vibe(['tokens', 'off']);
    vibe(['intent', 'draft', '--stdin'], GRAPH);
    vibe(['approve']);
    vibe(['check', 'build']);
    const out = vibe(['state', '--graph']);
    expect(out.status).toBe(0);
    const graph = (out.json as { graph: string }).graph;
    expect(graph).toContain('graph LR');
    expect(graph).toContain('build["build ✔"]:::pass');
    expect(graph).toContain('tests["tests ·"]:::never');
    expect(graph).toContain('build --> tests');
  });

  it('ledger why walks caused → implements → decided-by edges back to the approval', () => {
    execFileSync('git', ['init', '-q'], { cwd: root });
    vibe(['tokens', 'off']);
    vibe(['intent', 'draft', '--stdin'], GRAPH);
    const first = (vibe(['state']).json as { intent: { hash: string } }).intent.hash;
    vibe(['approve']);
    vibe(['check', '--all']);
    const reg = vibe(['regress', 'record', '--scenario', 'tests', '--title', 'out lost x', '--check-from-evidence', 'r-1']);
    expect(reg.status).toBe(0);
    const id = (reg.json as { id: string }).id;

    const about = vibe(['ledger', 'why', id]);
    expect(about.status).toBe(0);
    const steps = (about.json as { steps: Array<{ depth: number; edge: { type: string; from: string; to: string } }> }).steps;
    expect(steps.map((s) => s.edge.type)).toEqual(expect.arrayContaining(['caused', 'implements']));
    expect(steps.find((s) => s.edge.type === 'caused' && s.edge.to === 'scenario:tests')).toBeTruthy();
    expect(steps.find((s) => s.edge.type === 'implements' && s.edge.to === 'file:out.txt')).toBeTruthy();

    // which approval covers this file? file → implements ← scenario … the intent decided by chat
    const decided = vibe(['ledger', 'edges', '--type', 'decided-by']).json as Array<{ from: string; to: string }>;
    expect(decided).toEqual([{ at: expect.any(String), event: 'approve', type: 'decided-by', from: `intent:${first}`, to: 'human:chat' }]);

    // a redraft supersedes the previous intent
    vibe(['intent', 'draft', '--stdin'], GRAPH.replace('out has x', 'out still has x'));
    const sup = vibe(['ledger', 'edges', '--type', 'supersedes']).json as Array<{ to: string }>;
    expect(sup).toHaveLength(1);
    expect(sup[0]?.to).toBe(`intent:${first}`);
    expect(vibe(['ledger', 'why', 'nothing-here']).status).toBe(1);
  });
});

describe('profile — the harness reads the sample before the interview', () => {
  it('profile prints anomalies first and works without .vibe', () => {
    fs.writeFileSync(path.join(root, 'sample.csv'), 'id,qty\n1,2\n1,2\n2,\n');
    const out = vibe(['profile', 'sample.csv']);
    expect(out.status).toBe(0);
    expect(out.json).toMatchObject({ rows: 3, duplicateRows: 1, anomalies: ['1 duplicate rows (identical in every column)', 'column "qty" is missing in 1 of 3 rows'] });
    expect(vibe(['profile']).status).toBe(2);
  });
});

describe('skills — from proposal to installed, through the CLI', () => {
  it('skill lifecycle: search finds a catalog skill through the fixture, add previews then installs, state carries proposals', () => {
    const fixture = path.join(root, 'fixture.json');
    const skillMd = '---\nname: deploy-to-vercel\n---\n```\nvercel deploy --prod\n```\n';
    fs.writeFileSync(fixture, JSON.stringify({
      '/branches/main': { commit: { sha: '0123456789abcdef' } },
      '/contents/skills/deploy-to-vercel/SKILL.md?': { name: 'SKILL.md', type: 'file', path: 'skills/deploy-to-vercel/SKILL.md', content: Buffer.from(skillMd).toString('base64'), encoding: 'base64' },
      '/contents/skills/deploy-to-vercel?': [{ name: 'SKILL.md', type: 'file', path: 'skills/deploy-to-vercel/SKILL.md' }],
      '/repos/vercel-labs/agent-skills/git/trees': { tree: [{ path: 'skills/deploy-to-vercel/SKILL.md', type: 'blob' }] },
      '/git/trees': { tree: [] },
      '/search/code': { items: [] },
      '/repos/vercel-labs/agent-skills': { default_branch: 'main', license: { spdx_id: 'MIT' } },
    }));
    const env = { VIBE_GITHUB_FIXTURE: fixture };
    vibe(['tokens', 'off']);
    vibe(['intent', 'draft', '--stdin'], JSON.stringify({ intent: '# Deploy\n\n## Why\nx\n', scenarios: '- { id: live, then: x, check: { type: http, url: "https://api.vercel.com/v9/projects" } }\n' }));
    const proposals = (vibe(['state']).json as { proposals: Array<{ ref: string }> }).proposals;
    expect(proposals.map((p) => p.ref)).toEqual(['vibe skill search vercel']);

    const search = vibe(['skill', 'search', 'vercel'], undefined, env);
    expect(search.status).toBe(0);
    expect((search.json as { candidates: Array<{ action: string }> }).candidates[0]?.action).toBe('vibe skill add vercel-labs/agent-skills@deploy-to-vercel');

    const preview = vibe(['skill', 'add', 'vercel-labs/agent-skills@deploy-to-vercel'], undefined, env);
    expect(preview.status).toBe(3);
    expect((preview.json as { commands: string[] }).commands).toEqual(['vercel deploy --prod']);
    expect(fs.existsSync(path.join(root, '.claude', 'skills', 'deploy-to-vercel'))).toBe(false);
    const install = vibe(['skill', 'add', 'vercel-labs/agent-skills@deploy-to-vercel', '--yes'], undefined, env);
    expect(install.status).toBe(0);
    expect(fs.existsSync(path.join(root, '.claude', 'skills', 'deploy-to-vercel', 'SKILL.md'))).toBe(true);
    const list = vibe(['skill', 'list']).json as { project: Array<{ name: string; source: string }> };
    expect(list.project[0]).toMatchObject({ name: 'deploy-to-vercel', source: 'vercel-labs/agent-skills@deploy-to-vercel#0123456789ab' });
    expect(vibe(['skill', 'prune', '--dry-run', '--unused-runs', '0']).json).toMatchObject({ removed: ['deploy-to-vercel'] });
    expect(vibe(['skill', 'create', 'nocheck']).status).toBe(2);
    expect(vibe(['skill', 'create', 'live-guard', '--from-scenario', 'live']).status).toBe(0);
    expect(vibe(['research', '--from-intent', '--sources', 'skills'], undefined, env).status).toBe(0);
  });
});

describe('installed binary', () => {
  it('guard: the file URL matches its own path and a symlink to it, a percent-encoded space included, and not another file', async () => {
    const { sameFile } = await import('./cli.js');
    const dir = path.join(root, 'with space');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'cli.js');
    fs.writeFileSync(file, '');
    fs.writeFileSync(path.join(dir, 'other.js'), '');
    fs.symlinkSync(file, path.join(root, 'vibe-link'));
    const url = pathToFileURL(file).href;
    expect(url).toContain('%20');
    expect(sameFile(file, url)).toBe(true);
    expect(sameFile(path.join(root, 'vibe-link'), url)).toBe(true);
    expect(sameFile(path.join(dir, 'other.js'), url)).toBe(false);
    expect(sameFile(undefined, url)).toBe(false);
  });

  it('symlink: runs when invoked through a bin symlink, the way a global install calls it', () => {
    const dist = path.join(here, '..', 'dist', 'cli.js');
    if (!fs.existsSync(dist)) throw new Error('build first — this test runs the built CLI through a symlink');
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin);
    fs.symlinkSync(dist, path.join(bin, 'vibe'));
    const r = spawnSync('node', [path.join(bin, 'vibe'), '--version'], { encoding: 'utf-8', env: { ...process.env, HOME: fixtureHome } });
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('usage — what the readers spend is in the ledger', () => {
  it('usage: vibe read --ask through a fake claude inside a project leaves a usage event that vibe ledger --json lists', () => {
    const bin = path.join(root, 'fakebin');
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, 'claude'), `#!${process.execPath}
      const a = process.argv.slice(2);
      if (a[0] === '--version') { process.stdout.write('1.0.0\\n'); process.exit(0); }
      require('fs').readFileSync(0, 'utf-8');
      process.stdout.write(JSON.stringify({ session_id: 'sess', result: 'the answer', total_cost_usd: 0.002, modelUsage: { 'claude-haiku-4-5': {} }, usage: { input_tokens: 9, cache_creation_input_tokens: 700, cache_read_input_tokens: 0, output_tokens: 12 } }));
    `, { mode: 0o755 });
    const project = path.join(root, 'proj');
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(path.join(project, 'a.ts'), 'export const a = 1;\n');
    const env = { PATH: `${bin}${path.delimiter}${path.dirname(process.execPath)}`, VIBE_HOME_DIR: root };
    const draft = vibe(['intent', 'draft', '--stdin'], JSON.stringify({ intent: '# t\n', scenarios: '- { id: x, then: y, check: { type: run, cmd: "true" } }\n' }), env, project);
    expect(draft.status).toBe(0);
    const read = vibe(['read', 'a.ts', '--ask', 'what is a?'], undefined, env, project);
    expect(read.status).toBe(0);
    expect((read.json as { reply: string; usage: { cacheWrite: number } }).reply).toBe('the answer');
    const ledger = vibe(['ledger'], undefined, env, project);
    type Ev = { event: string; detail?: string; tokens?: { cacheWrite: number }; costUsd?: number; model?: string };
    const all = Array.isArray(ledger.json) ? (ledger.json as Ev[]) : (ledger.json as { events: Ev[] }).events;
    const usage = all.filter((e) => e.event === 'usage');
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ detail: 'reader', tokens: { cacheWrite: 700 }, costUsd: 0.002, model: 'claude-haiku-4-5' });
  });
});
