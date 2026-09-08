import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addKnowledge, globalKnowledgeDir, knowledgeDir } from './knowledge.js';

let root: string;
let home: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-knowledge-'));
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-knowledge-home-'));
  process.env['VIBE_HOME_DIR'] = home;
  fs.mkdirSync(path.join(root, '.vibe'), { recursive: true });
});

afterEach(() => {
  delete process.env['VIBE_HOME_DIR'];
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

describe('addKnowledge', () => {
  it('writes a project note under .vibe/knowledge', () => {
    const r = addKnowledge(root, 'a note', 'body text');
    expect(r.file).toBe(path.join(knowledgeDir(root), 'a-note.md'));
    expect(fs.readFileSync(r.file, 'utf-8')).toContain('body text');
  });

  it('--global lands the note under the home directory, not the project', () => {
    const r = addKnowledge(root, 'a global note', 'shared body', { global: true });
    expect(r.file).toBe(path.join(globalKnowledgeDir(home), 'a-global-note.md'));
    expect(r.file.startsWith(root)).toBe(false);
    expect(fs.readFileSync(r.file, 'utf-8')).toContain('shared body');
  });

  it('rejects an empty title or body regardless of the global option', () => {
    expect(() => addKnowledge(root, '', 'body')).toThrow();
    expect(() => addKnowledge(root, 'title', '', { global: true })).toThrow();
  });
});
