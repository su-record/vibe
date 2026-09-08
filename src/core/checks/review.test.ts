import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reviewCheck } from './review.js';

let root: string;
let script: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-review-'));
  script = path.join(root, 'reviewer.js');
  fs.writeFileSync(path.join(root, 'column.md'), '# 제목\n\n이 칼럼은 구체적인 장면에서 시작한다. 편집자가 확인할 사실은 세 가지이고, 문단마다 판단이 하나씩 전진한다.\n');
  fs.writeFileSync(path.join(root, 'contract.md'), 'outlet: weekly column · 900 words\n');
  fs.mkdirSync(path.join(root, 'ui'));
  fs.writeFileSync(path.join(root, 'ui', 'page.html'), '<main>\n  <h1>Welcome back</h1>\n</main>\n');
  fs.writeFileSync(path.join(root, 'ui', 'style.css'), '.hero { background: linear-gradient(135deg, #667eea, #764ba2); }\n');
  fs.writeFileSync(path.join(root, 'shot.png'), 'not really a png');
});
const savedPath = process.env['PATH'];
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env['VIBE_REVIEW_CMD'];
  delete process.env['VIBE_REVIEW_CLIENT'];
  delete process.env['VIBE_REVIEWER_MODEL'];
  delete process.env['VIBE_REVIEWER_EFFORT'];
  delete process.env['VIBE_HOME_DIR'];
  process.env['PATH'] = savedPath;
});

/** A fake client CLI on PATH that answers PASS in the real CLI's JSON and records its argv, cwd and stdin. */
function fakeCli(name: 'claude' | 'codex'): string {
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const log = path.join(root, `${name}.log`);
  const reply = name === 'claude'
    ? `out(JSON.stringify({ session_id: 's', result: 'PASS', total_cost_usd: 0.01, modelUsage: { 'claude-opus-5': {} }, usage: { input_tokens: 1204, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 3 } }));`
    : `out(JSON.stringify({ type: 'thread.started', thread_id: 't' }) + '\\n' + JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'PASS' } }) + '\\n' + JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 5000, cached_input_tokens: 4000, cache_write_input_tokens: 0, output_tokens: 3 } }) + '\\n');`;
  fs.writeFileSync(path.join(bin, name), `#!${process.execPath}
    const fs = require('fs');
    const a = process.argv.slice(2);
    if (a[0] === '--version') { process.stdout.write('1.0.0\\n'); process.exit(0); }
    const stdin = fs.readFileSync(0, 'utf-8');
    fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ argv: a, cwd: process.cwd(), stdin }) + '\\n---\\n');
    const out = (s) => process.stdout.write(s);
    ${reply}
  `, { mode: 0o755 });
  process.env['PATH'] = `${bin}${path.delimiter}${path.dirname(process.execPath)}`;
  process.env['VIBE_HOME_DIR'] = root;
  return log;
}
const calls = (log: string): Array<{ argv: string[]; cwd: string; stdin: string }> => fs.readFileSync(log, 'utf-8').split('\n---\n').filter(Boolean).map((l) => JSON.parse(l) as { argv: string[]; cwd: string; stdin: string });

/** A fake reviewer: answers from a queue file, one reply per call, and records what it was asked. */
function fakeReviewer(replies: string[]): void {
  fs.writeFileSync(path.join(root, 'replies.json'), JSON.stringify(replies));
  fs.writeFileSync(script, `
    const fs = require('fs');
    const q = JSON.parse(fs.readFileSync('${path.join(root, 'replies.json')}', 'utf-8'));
    const prompt = fs.readFileSync(0, 'utf-8');
    fs.appendFileSync('${path.join(root, 'asked.log')}', prompt.split('\\n')[0] + '\\n');
    fs.appendFileSync('${path.join(root, 'prompts.log')}', prompt + '\\n=====\\n');
    process.stdout.write(q.shift() ?? '');
    fs.writeFileSync('${path.join(root, 'replies.json')}', JSON.stringify(q));
  `);
  process.env['VIBE_REVIEW_CMD'] = `node ${script}`;
}

describe('review check — the harness runs the reviewers and reads only PASS', () => {
  it('passes when both stages answer exactly PASS, in order, with the contract in the bundle', async () => {
    fakeReviewer(['PASS\n', '  PASS  ']);
    const r = await reviewCheck({ type: 'review', path: 'column.md', contract: 'contract.md' }, root);
    expect(r.pass).toBe(true);
    expect(r.tail).toBe('ko copy-editor: PASS\nko chief-editor: PASS');
    expect(fs.readFileSync(path.join(root, 'asked.log'), 'utf-8').trim().split('\n')).toHaveLength(2);
  });

  it('fails on a REJECT list and keeps it in the tail; the second stage is not asked', async () => {
    fakeReviewer(['REJECT\n2문단 | 근거 없는 최상급 | 독자가 검증 불가 | 수치 출처 추가', 'PASS']);
    const r = await reviewCheck({ type: 'review', path: 'column.md' }, root);
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('copy-editor did not pass');
    expect(r.tail).toContain('REJECT');
    expect(r.tail).toContain('근거 없는 최상급');
    expect(fs.readFileSync(path.join(root, 'asked.log'), 'utf-8').trim().split('\n')).toHaveLength(1);
  });

  it('a PASS with a remark is not a pass', async () => {
    fakeReviewer(['PASS', 'PASS — but consider a shorter headline']);
    const r = await reviewCheck({ type: 'review', path: 'column.md' }, root);
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('chief-editor did not pass');
    expect(r.tail).toContain('ko copy-editor: PASS');
    expect(r.tail).toContain('not PASS');
  });

  it('an unknown language without lang fails with a reason; lang: ko overrides detection', async () => {
    fs.writeFileSync(path.join(root, 'short.md'), 'ok\n');
    fakeReviewer(['PASS', 'PASS']);
    const unknown = await reviewCheck({ type: 'review', path: 'short.md' }, root);
    expect(unknown.pass).toBe(false);
    expect(unknown.reason).toContain('language unknown');
    const forced = await reviewCheck({ type: 'review', path: 'short.md', lang: 'ko' }, root);
    expect(forced.pass).toBe(true);
  });

  it('pack: design collects source from a file or a directory, numbers it, carries the screenshot line, and runs the stages named by the prefixes', async () => {
    fakeReviewer(['PASS', 'PASS', 'PASS', 'PASS']);
    const one = await reviewCheck({ type: 'review', pack: 'design', path: 'ui/page.html' }, root);
    expect(one.pass).toBe(true);
    expect(one.tail).toBe('design markup-reviewer: PASS\ndesign art-director: PASS');
    const many = await reviewCheck({ type: 'review', pack: 'design', path: 'ui', contract: 'contract.md', screenshot: 'shot.png' }, root);
    expect(many.pass).toBe(true);
    const prompts = fs.readFileSync(path.join(root, 'prompts.log'), 'utf-8').split('\n=====\n').filter(Boolean);
    expect(prompts).toHaveLength(4);
    expect(prompts[0]).toContain('<file path="ui/page.html"');
    expect(prompts[0]).toContain('1| <main>');
    expect(prompts[0]).toContain('## Source');
    expect(prompts[0]).not.toContain('## Manuscript');
    expect(prompts[2]).toContain('<file path="ui/page.html"'); // the directory brings both files, sorted
    expect(prompts[2]).toContain('<file path="ui/style.css"');
    expect(prompts[2]).toContain('## Screenshot');
    expect(prompts[2]).toContain(path.join(root, 'shot.png'));
    expect(prompts[2]).toContain('outlet: weekly column');
  });

  it('pack: an unknown pack fails with a reason, and a directory without lang or pack is not guessed at', async () => {
    fakeReviewer(['PASS', 'PASS']);
    const unknown = await reviewCheck({ type: 'review', pack: 'klingon', path: 'column.md' }, root);
    expect(unknown.pass).toBe(false);
    expect(unknown.reason).toBe('no reviewers/klingon in this package');
    const dir = await reviewCheck({ type: 'review', path: 'ui' }, root);
    expect(dir.pass).toBe(false);
    expect(dir.reason).toContain('language unknown');
  });

  it('driver: claude gets the stage prompt as its system prompt with the slim flags and the reviewer tools, in the neutral directory, no session; the tail carries usage', async () => {
    const log = fakeCli('claude');
    process.env['VIBE_REVIEW_CLIENT'] = 'claude';
    const r = await reviewCheck({ type: 'review', path: 'column.md', contract: 'contract.md' }, root);
    expect(r.pass).toBe(true);
    expect(r.tail).toBe('ko copy-editor: PASS · in 1,204 · cache read 0 · out 3\nko chief-editor: PASS · in 1,204 · cache read 0 · out 3');
    expect(r.usage).toEqual([{ stage: 'copy-editor', input: 1204, cacheRead: 0, cacheWrite: 0, output: 3 }, { stage: 'chief-editor', input: 1204, cacheRead: 0, cacheWrite: 0, output: 3 }]);
    const [first, second] = calls(log);
    expect(first?.argv[0]).toBe('-p');
    expect(first?.argv).toEqual(expect.arrayContaining(['--system-prompt', '--output-format', 'json', '--tools', 'Read', '--disable-slash-commands', '--strict-mcp-config', '--setting-sources', '']));
    expect(first?.argv).not.toContain('--model'); // judgment keeps the client's default model
    expect(first?.argv).not.toContain('--resume');
    const prompt = (c: { argv: string[] } | undefined): string => c?.argv[c.argv.indexOf('--system-prompt') + 1] ?? '';
    expect(prompt(first)).toBe(fs.readFileSync(path.join(process.cwd(), 'reviewers', 'ko', '1-copy-editor.md'), 'utf-8').trim());
    expect(prompt(second)).toBe(fs.readFileSync(path.join(process.cwd(), 'reviewers', 'ko', '2-chief-editor.md'), 'utf-8').trim());
    expect(first?.cwd).toBe(path.join(root, '.config', 'vibe', 'reader'));
    expect(first?.stdin.startsWith('## Editorial contract')).toBe(true);
    expect(first?.stdin).toContain('## Manuscript');
  });

  it('driver: codex runs exec --skip-git-repo-check --json with the prompt leading the message, no resume, and the pack: design source', async () => {
    const log = fakeCli('codex');
    process.env['VIBE_REVIEW_CLIENT'] = 'codex';
    const r = await reviewCheck({ type: 'review', pack: 'design', path: 'ui' }, root);
    expect(r.pass).toBe(true);
    expect(r.tail).toContain('design markup-reviewer: PASS · in 1,000 · cache read 4,000 · out 3');
    const [first] = calls(log);
    expect(first?.argv).toEqual(['exec', '--skip-git-repo-check', '--json', '-']);
    expect(first?.stdin.startsWith('You are a front-end lead')).toBe(true);
    expect(first?.stdin).toContain('## Source');
  });

  it('changed: nothing changed passes with the tail and asks no reviewer; a change sends the roles', async () => {
    const { execFileSync } = await import('node:child_process');
    const g = (...args: string[]): string => execFileSync('git', ['-C', root, ...args], { encoding: 'utf-8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
    g('init', '-q');
    g('add', '.');
    g('commit', '-q', '-m', 'base');
    fakeReviewer(['PASS', 'PASS']);
    const quiet = await reviewCheck({ type: 'review', pack: 'design', path: 'ui', changed: true }, root);
    expect(quiet).toMatchObject({ pass: true, tail: 'nothing changed under ui since HEAD — nothing reviewed' });
    expect(fs.existsSync(path.join(root, 'asked.log'))).toBe(false);
    fs.appendFileSync(path.join(root, 'ui', 'style.css'), '.x { color: red; }\n');
    const r = await reviewCheck({ type: 'review', pack: 'design', path: 'ui', changed: true }, root);
    expect(r.pass).toBe(true);
    const prompts = fs.readFileSync(path.join(root, 'prompts.log'), 'utf-8');
    expect(prompts).toContain('Changed since HEAD: ui/style.css');
    expect(prompts).toContain('<file path="ui/style.css" role="changed">');
    expect(prompts).not.toContain('<file path="ui/page.html"'); // page.html does not import the stylesheet
  });

  it('model: the project config sets the reviewer model and effort; the env wins; unset keeps the client default', async () => {
    const log = fakeCli('claude');
    process.env['VIBE_REVIEW_CLIENT'] = 'claude';
    fs.mkdirSync(path.join(root, '.vibe'), { recursive: true });
    fs.writeFileSync(path.join(root, '.vibe', 'config.json'), JSON.stringify({ reviewer: { model: 'big-judge', effort: 'high' } }));
    await reviewCheck({ type: 'review', path: 'column.md' }, root);
    const [first] = calls(log);
    expect(first?.argv).toEqual(expect.arrayContaining(['--model', 'big-judge', '--effort', 'high']));
    process.env['VIBE_REVIEWER_EFFORT'] = 'max';
    await reviewCheck({ type: 'review', path: 'column.md' }, root);
    expect(calls(log)[2]?.argv).toEqual(expect.arrayContaining(['--model', 'big-judge', '--effort', 'max']));
    fs.rmSync(path.join(root, '.vibe', 'config.json'));
    delete process.env['VIBE_REVIEWER_EFFORT'];
    await reviewCheck({ type: 'review', path: 'column.md' }, root);
    const plain = calls(log)[4]?.argv ?? [];
    expect(plain).not.toContain('--model');
    expect(plain).not.toContain('--effort');
  });
});
