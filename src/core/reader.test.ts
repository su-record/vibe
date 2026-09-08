import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { askReader, bundleFiles, numberLines, READER_MAX_CHARS, readerCommand, readerPrompt } from './reader.js';
import { claudeArgs, READER_DRIVER, SESSION_TTL_MS, shellArgs, systemPromptArgs, winQuote } from './readerSession.js';

let root: string;
let home: string;
const savedPath = process.env['PATH'];
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-reader-'));
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-reader-home-'));
  fs.writeFileSync(path.join(root, 'a.ts'), 'export const a = 1;\nexport const b = 2;\n');
  fs.writeFileSync(path.join(root, 'b.csv'), 'id,total\n1,10\n2,20\n');
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
  delete process.env['VIBE_READER_CMD'];
  process.env['PATH'] = savedPath;
});

/**
 * A fake client CLI on PATH: answers `--version`, records argv and stdin to a log, and replies in
 * the real CLI's JSON — a new session id on a fresh call, the resumed id with cache reads on `--resume`.
 */
function fakeClient(name: 'claude' | 'codex'): string {
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const log = path.join(home, `${name}.log`);
  const claude = `
    const id = r >= 0 ? a[r + 1] : 'sess-' + n;
    out(JSON.stringify({ session_id: id, result: 'answer ' + n, usage: { input_tokens: 9, cache_creation_input_tokens: r >= 0 ? 900 : 13000, cache_read_input_tokens: r >= 0 ? 13000 : 0, output_tokens: 40 } }));`;
  const codex = `
    const id = r >= 0 ? a[r + 1] : 'thread-' + n;
    out(JSON.stringify({ type: 'thread.started', thread_id: id }) + '\\n' + JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'answer ' + n } }) + '\\n' + JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 27000, cached_input_tokens: r >= 0 ? 21000 : 12000, cache_write_input_tokens: 0, output_tokens: 6 } }) + '\\n');`;
  fs.writeFileSync(path.join(bin, name), `#!${process.execPath}
    const fs = require('fs');
    const a = process.argv.slice(2);
    if (a[0] === '--version') { process.stdout.write('1.0.0\\n'); process.exit(0); }
    const stdin = fs.readFileSync(0, 'utf-8');
    const n = fs.existsSync(${JSON.stringify(log)}) ? fs.readFileSync(${JSON.stringify(log)}, 'utf-8').split('\\n---\\n').length : 1;
    fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ argv: a, cwd: process.cwd(), stdin }) + '\\n---\\n');
    const r = a.indexOf(${name === 'claude' ? "'--resume'" : "'resume'"});
    const out = (s) => process.stdout.write(s);
    ${name === 'claude' ? claude : codex}
  `, { mode: 0o755 });
  process.env['PATH'] = `${bin}${path.delimiter}${path.dirname(process.execPath)}`;
  return log;
}

function calls(log: string): Array<{ argv: string[]; cwd: string; stdin: string }> {
  return fs.readFileSync(log, 'utf-8').split('\n---\n').filter(Boolean).map((l) => JSON.parse(l) as { argv: string[]; cwd: string; stdin: string });
}

/** A fake reader that echoes the prompt it received, so the test can look at the bundle. */
function echoReader(): string {
  const script = path.join(root, 'echo.js');
  fs.writeFileSync(script, "process.stdout.write(require('fs').readFileSync(0, 'utf-8'));");
  return `node ${script}`;
}

describe('vibe read --ask — the harness reads for the model', () => {
  it('numbers code lines, wraps every file in a tag, leaves tables as markdown, and puts the question last', () => {
    const bundle = bundleFiles(root, ['a.ts', 'b.csv']);
    expect(bundle.files).toEqual(['a.ts', 'b.csv']);
    expect(bundle.text).toContain('<file path="a.ts" format="text">\n1| export const a = 1;\n2| export const b = 2;\n</file>');
    expect(bundle.text).toContain('<file path="b.csv" format="csv">\n## b.csv\n| id | total |');
    const prompt = readerPrompt(bundle, 'what is b?');
    expect(prompt.trim().endsWith('## Question\n\nwhat is b?')).toBe(true);
    expect(prompt.indexOf('<file')).toBeGreaterThan(prompt.indexOf('You are a reader'));
  });

  it('pads line numbers to the widest, so every line starts in the same column', () => {
    expect(numberLines('a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n')).toMatch(/^ 1\| a\n 2\| b/);
    expect(numberLines('a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n')).toMatch(/\n10\| j$/);
  });

  it('sends the bundle on stdin and returns the reply with the file list, size and reader', async () => {
    process.env['VIBE_READER_CMD'] = echoReader();
    const r = await askReader(root, ['a.ts'], 'what is a?');
    expect(r.reader).toContain('echo.js');
    expect(r.session).toEqual({ id: null, resumed: false });
    expect(r.files).toEqual(['a.ts']);
    expect(r.reply).toContain('1| export const a = 1;');
    expect(r.reply.endsWith('what is a?')).toBe(true);
    expect(r.chars).toBeGreaterThan(0);
  });

  it('caps the bundle and names the file where the cap was crossed', () => {
    fs.writeFileSync(path.join(root, 'big.txt'), 'x'.repeat(READER_MAX_CHARS + 1));
    expect(() => bundleFiles(root, ['a.ts', 'big.txt'])).toThrow(/exceed 400000 characters at big.txt/);
  });

  it('no reader: exit 2 and the message names VIBE_READER_CMD, config reader, claude and codex', async () => {
    process.env['PATH'] = root; // nothing on it
    expect(readerCommand(root)).toBeNull();
    await expect(askReader(root, ['a.ts'], 'q')).rejects.toMatchObject({ exitCode: 2, message: expect.stringMatching(/VIBE_READER_CMD.*config\.json.*claude.*codex/) });
  });

  it('config.json reader wins over PATH; the env wins over both', () => {
    fs.mkdirSync(path.join(root, '.vibe'));
    fs.writeFileSync(path.join(root, '.vibe', 'config.json'), JSON.stringify({ reader: 'my-reader --fast' }));
    expect(readerCommand(root)).toBe('my-reader --fast');
    process.env['VIBE_READER_CMD'] = 'other';
    expect(readerCommand(root)).toBe('other');
  });

  it('a failing reader is an error that carries its output; an empty question is usage', async () => {
    const script = path.join(root, 'fail.js');
    fs.writeFileSync(script, "process.stdout.write('quota exceeded'); process.exit(3);");
    process.env['VIBE_READER_CMD'] = `node ${script}`;
    await expect(askReader(root, ['a.ts'], 'q')).rejects.toThrow(/exit 3.*\nquota exceeded/s);
    await expect(askReader(root, ['a.ts'], '  ')).rejects.toThrow(/needs a question/);
  });

  it('session: claude gets the slim flags in the neutral directory; the second ask resumes with only the question; a changed file and an aged entry start new sessions', async () => {
    const log = fakeClient('claude');
    const now = Date.now();
    const first = await askReader(root, ['a.ts', 'b.csv'], 'what is a?', { home, now });
    expect(first.reader).toBe('claude haiku');
    expect(first.session).toEqual({ id: 'sess-1', resumed: false });
    expect(first.usage).toEqual({ input: 9, cacheRead: 0, cacheWrite: 13000, output: 40 });
    expect(first.reply).toBe('answer 1');
    const [c1] = calls(log);
    expect(c1?.argv.slice(0, 1)).toEqual(['-p']);
    expect(c1?.argv).toContain('--system-prompt');
    expect(c1?.argv).toEqual(expect.arrayContaining(['--tools', '', '--disable-slash-commands', '--strict-mcp-config', '--setting-sources', '', '--output-format', 'json', '--model', 'haiku']));
    expect(c1?.argv).not.toContain('--resume');
    expect(c1?.cwd).toBe(path.join(home, '.config', 'vibe', 'reader'));
    expect(c1?.stdin).toContain('<file path="a.ts"');
    expect(c1?.stdin.trim().endsWith('## Question\n\nwhat is a?')).toBe(true);
    expect(c1?.stdin).not.toContain('You are a reader'); // that is the system prompt, not the message

    const second = await askReader(root, ['a.ts', 'b.csv'], 'and b?', { home, now: now + 60_000 });
    expect(second.session).toEqual({ id: 'sess-1', resumed: true });
    expect(second.usage?.cacheRead).toBe(13000);
    const c2 = calls(log)[1];
    expect(c2?.argv).toContain('--resume');
    expect(c2?.argv[c2.argv.indexOf('--resume') + 1]).toBe('sess-1');
    expect(c2?.stdin).not.toContain('<file');
    expect(c2?.stdin).toContain('## Question\n\nand b?');

    fs.appendFileSync(path.join(root, 'a.ts'), 'export const c = 3;\n');
    const changed = await askReader(root, ['a.ts', 'b.csv'], 'and c?', { home, now: now + 120_000 });
    expect(changed.session).toEqual({ id: 'sess-3', resumed: false });

    const aged = await askReader(root, ['a.ts', 'b.csv'], 'still c?', { home, now: now + 120_000 + SESSION_TTL_MS + 1 });
    expect(aged.session).toEqual({ id: 'sess-4', resumed: false });
    const index = JSON.parse(fs.readFileSync(path.join(home, '.config', 'vibe', 'reader', 'sessions.json'), 'utf-8')) as Record<string, { id: string }>;
    expect(Object.values(index).map((e) => e.id)).toEqual(['sess-4']); // the aged ones were dropped
  });

  it('session: codex runs exec --skip-git-repo-check --json at low reasoning, reads the thread id and cached tokens, and resumes by thread', async () => {
    const log = fakeClient('codex');
    const now = Date.now();
    const first = await askReader(root, ['a.ts'], 'q1', { home, now });
    expect(first.reader).toBe('codex default/low');
    expect(first.session).toEqual({ id: 'thread-1', resumed: false });
    expect(first.usage).toEqual({ input: 15000, cacheRead: 12000, cacheWrite: 0, output: 6 });
    expect(first.reply).toBe('answer 1');
    const [c1] = calls(log);
    expect(c1?.argv).toEqual(['exec', '--skip-git-repo-check', '--json', '-c', 'model_reasoning_effort=low', '-']);
    expect(c1?.stdin.startsWith('You are a reader')).toBe(true); // codex has no system prompt flag: the instructions lead the message
    const second = await askReader(root, ['a.ts'], 'q2', { home, now: now + 1000 });
    expect(second.session).toEqual({ id: 'thread-1', resumed: true });
    expect(second.usage?.cacheRead).toBe(21000);
    expect(calls(log)[1]?.argv).toEqual(['exec', '--skip-git-repo-check', 'resume', 'thread-1', '--json', '-c', 'model_reasoning_effort=low', '-']);
  });

  it('model: the project config sets the reader model and effort on either client, the env wins for one run, and a changed model starts a new session', async () => {
    const log = fakeClient('claude');
    fs.mkdirSync(path.join(root, '.vibe'), { recursive: true });
    fs.writeFileSync(path.join(root, '.vibe', 'config.json'), JSON.stringify({ reader: { model: 'my-small', effort: 'medium' } }));
    const now = Date.now();
    const first = await askReader(root, ['a.ts'], 'q', { home, now });
    expect(first.reader).toBe('claude my-small/medium');
    const [c1] = calls(log);
    expect(c1?.argv).toEqual(expect.arrayContaining(['--model', 'my-small', '--effort', 'medium']));
    process.env['VIBE_READER_MODEL'] = 'other-model';
    const second = await askReader(root, ['a.ts'], 'q', { home, now: now + 1000 });
    expect(second.reader).toBe('claude other-model/medium');
    expect(second.session.resumed).toBe(false); // a different model is a different session
    expect(calls(log)[1]?.argv).toEqual(expect.arrayContaining(['--model', 'other-model']));
    delete process.env['VIBE_READER_MODEL'];
    const third = await askReader(root, ['a.ts'], 'q', { home, now: now + 2000 });
    expect(third.session).toEqual({ id: 'sess-1', resumed: true }); // back to the configured model, back to its session

    const codexLog = fakeClient('codex');
    fs.rmSync(path.join(home, 'bin', 'claude')); // only codex on PATH now
    const onCodex = await askReader(root, ['a.ts'], 'q', { home, now: now + 3000 });
    expect(onCodex.reader).toBe('codex my-small/medium');
    expect(calls(codexLog)[0]?.argv).toEqual(['exec', '--skip-git-repo-check', '--json', '-m', 'my-small', '-c', 'model_reasoning_effort=medium', '-']);
    fs.rmSync(path.join(root, '.vibe', 'config.json'));
    const plain = await askReader(root, ['a.ts'], 'q', { home, now: now + 4000 });
    expect(plain.reader).toBe('codex default/low'); // unset keeps the defaults
  });

  it('quoting: an empty, a spaced and a quoted argument are quoted for cmd.exe, a plain one is not, and only win32 quotes', () => {
    expect(winQuote('')).toBe('""');
    expect(winQuote('a b')).toBe('"a b"');
    expect(winQuote('say "hi"')).toBe('"say \\"hi\\""');
    expect(winQuote('--tools')).toBe('--tools');
    const args = claudeArgs('You are a reader.', null, READER_DRIVER);
    expect(args).toContain(''); // --tools '' and --setting-sources ''
    expect(shellArgs(args, 'linux')).toEqual(args);
    const win = shellArgs(args, 'win32');
    expect(win[win.indexOf('--tools') + 1]).toBe('""');
    expect(win[win.indexOf('--setting-sources') + 1]).toBe('""');
    expect(win[win.indexOf('--system-prompt') + 1]).toBe('"You are a reader."');
    expect(win).toContain('--disable-slash-commands');
    // on Windows a multi-line prompt cannot travel as an argument: it goes through a file
    const onWin = claudeArgs('line one\nline two', null, READER_DRIVER, 'win32');
    expect(onWin).not.toContain('--system-prompt');
    const file = onWin[onWin.indexOf('--system-prompt-file') + 1]!;
    expect(fs.readFileSync(file, 'utf-8')).toBe('line one\nline two');
    expect(systemPromptArgs('x', 'linux')).toEqual(['--system-prompt', 'x']);
  });
});
