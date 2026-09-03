import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Every call spawns tsx; under `vibe check` several vitest processes run at once, so 5s is too tight.
vi.setConfig({ testTimeout: 60_000 });

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI_SRC = path.join(here, 'cli.ts');
const TSX = path.join(here, '..', 'node_modules', '.bin', 'tsx');

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-cli-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

interface Run {
  status: number;
  stdout: string;
  json: unknown;
}

function vibe(args: string[], input?: string): Run {
  const result = spawnSync(TSX, [CLI_SRC, ...args, '--json'], {
    cwd: root,
    encoding: 'utf-8',
    input,
    env: { ...process.env, VIBE_CLIENT: 'test-client' },
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
  it('strict: init → draft → approve(token) → check → DONE; the exit code is the verdict', () => {
    const init = vibe(['init', '--tokens', 'strict']);
    expect(init.status).toBe(0);
    expect((init.json as { tokens: string }).tokens).toBe('strict');
    expect(fs.existsSync(path.join(root, '.vibe', 'state.json'))).toBe(true);
    expect(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf-8')).toContain('<!-- vibe:start -->');
    expect(fs.existsSync(path.join(root, '.claude', 'skills', 'vibe', 'SKILL.md'))).toBe(true);

    const before = vibe(['state']);
    expect((before.json as { state: string }).state).toBe('NONE');

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

  it('default (irreversible): approve needs no token, authorize does', () => {
    vibe(['init']);
    const draft = vibe(['intent', 'draft', '--stdin'], HELLO);
    expect((draft.json as { token: string | null }).token).toBeNull();
    const approved = vibe(['approve']);
    expect(approved.status).toBe(0);
    expect((approved.json as { basis: string }).basis).toBe('chat');

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
    vibe(['init', '--tokens', 'off']);
    vibe(['intent', 'draft', '--stdin'], HELLO);
    expect(vibe(['approve']).status).toBe(0);
    const ask = vibe(['ask', 'Push?', '--needs', 'authorize:push']);
    expect((ask.json as { token: string | null }).token).toBeNull();
    const auth = vibe(['authorize', '--action', 'push']);
    expect(auth.status).toBe(0);
    expect((auth.json as { basis: string }).basis).toBe('auto');
  });

  it('continues across clients — approved under one, checked under another, both in the ledger', () => {
    const as = (client: string, args: string[], input?: string): Run => {
      const result = spawnSync(TSX, [CLI_SRC, ...args, '--json'], { cwd: root, encoding: 'utf-8', input, env: { ...process.env, VIBE_CLIENT: client }, timeout: 60000 });
      return { status: result.status ?? -1, stdout: result.stdout, json: JSON.parse(result.stdout) };
    };
    as('claude-code', ['init', '--client', 'claude,codex']);
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
    expect(fs.existsSync(path.join(root, '.codex', 'hooks.json'))).toBe(true);
  });

  it('uninstall removes card, skills and hook but keeps .vibe', () => {
    vibe(['init']);
    const out = vibe(['uninstall']);
    expect(out.status).toBe(0);
    expect(fs.existsSync(path.join(root, '.claude', 'skills', 'vibe'))).toBe(false);
    expect(fs.existsSync(path.join(root, '.vibe'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'CLAUDE.md'))).toBe(false);
  });

  it('help always exits 0', () => {
    expect(execFileSync(TSX, [CLI_SRC, '--help'], { cwd: root, encoding: 'utf-8' })).toContain('vibe');
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
    vibe(['init', '--tokens', 'off']);
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
    vibe(['init', '--tokens', 'off']);
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
