import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { askReader, bundleFiles, numberLines, READER_MAX_CHARS, readerCommand, readerPrompt } from './reader.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-reader-'));
  fs.writeFileSync(path.join(root, 'a.ts'), 'export const a = 1;\nexport const b = 2;\n');
  fs.writeFileSync(path.join(root, 'b.csv'), 'id,total\n1,10\n2,20\n');
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env['VIBE_READER_CMD'];
});

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
    const savedPath = process.env['PATH'];
    process.env['PATH'] = root; // nothing on it
    try {
      expect(readerCommand(root)).toBeNull();
      await expect(askReader(root, ['a.ts'], 'q')).rejects.toMatchObject({ exitCode: 2, message: expect.stringMatching(/VIBE_READER_CMD.*config\.json.*claude.*codex/) });
    } finally {
      process.env['PATH'] = savedPath;
    }
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
});
