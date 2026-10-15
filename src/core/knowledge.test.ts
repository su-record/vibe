import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addKnowledge, globalKnowledgeDir, knowledgeDir, knowledgeSettings, knowledgeSettingsFile, setKnowledgeSettings } from './knowledge.js';

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

  it('keeps session recording off until the person turns it on, and moves the wiki only to an absolute folder', () => {
    const defaults = { auto: false, turns: 5, skills: 'propose', exclude: [] };
    expect(knowledgeSettings(home)).toEqual(defaults);
    expect(globalKnowledgeDir(home)).toBe(path.join(home, '.config', 'vibe', 'knowledge'));
    const vault = path.join(home, 'Obsidian', 'vibe');
    expect(setKnowledgeSettings({ auto: true, dir: vault }, home)).toEqual({ ...defaults, auto: true, dir: vault });
    expect(setKnowledgeSettings({ auto: false }, home)).toEqual({ ...defaults, dir: vault });
    expect(globalKnowledgeDir(home)).toBe(vault);
    expect(addKnowledge(root, 'vault note', 'body', { global: true }).file).toBe(path.join(vault, 'vault-note.md'));
    expect(() => setKnowledgeSettings({ dir: 'relative' }, home)).toThrow('absolute');
    expect(() => setKnowledgeSettings({ exclude: 'relative' }, home)).toThrow('absolute');
    expect(() => setKnowledgeSettings({ turns: 1.5 }, home)).toThrow('whole number');
    expect(() => setKnowledgeSettings({ skills: 'always' }, home)).toThrow('propose | create');
    fs.writeFileSync(knowledgeSettingsFile(home), JSON.stringify({ auto: 'yes', dir: 'relative', turns: -1, skills: 'always', exclude: ['relative', 7] }));
    expect(knowledgeSettings(home)).toEqual(defaults);
  });

  it('adds and removes excluded folders once each and keeps the other settings', () => {
    const client = path.join(home, 'client');
    setKnowledgeSettings({ auto: true, turns: 0, skills: 'create' }, home);
    expect(setKnowledgeSettings({ exclude: client }, home).exclude).toEqual([client]);
    expect(setKnowledgeSettings({ exclude: `${client}/` }, home)).toEqual({ auto: true, turns: 0, skills: 'create', exclude: [client] });
    expect(setKnowledgeSettings({ include: client }, home).exclude).toEqual([]);
  });

  it('rejects an empty title or body regardless of the global option', () => {
    expect(() => addKnowledge(root, '', 'body')).toThrow();
    expect(() => addKnowledge(root, 'title', '', { global: true })).toThrow();
  });
});
