import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureProject } from './project.js';

let fixture: string;
beforeEach(() => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-project-'));
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(fixture, { recursive: true, force: true });
});

describe('automatic project creation respects shared roots', () => {
  it('refuses a new project in the configured home before writing anything', () => {
    vi.spyOn(os, 'homedir').mockReturnValue(fixture);
    expect(() => ensureProject(fixture)).toThrow('vibe will not create a project in your home directory — run it inside the project');
    expect(fs.readdirSync(fixture)).toEqual([]);
  });

  it('a home plugin store is not an existing project', () => {
    vi.spyOn(os, 'homedir').mockReturnValue(fixture);
    const plugin = path.join(fixture, '.vibe', 'plugin');
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(path.join(plugin, 'keep.txt'), 'keep');
    expect(() => ensureProject(fixture)).toThrow('run it inside the project');
    expect(fs.readdirSync(path.join(fixture, '.vibe'))).toEqual(['plugin']);
    expect(fs.readFileSync(path.join(plugin, 'keep.txt'), 'utf-8')).toBe('keep');
  });

  it('refuses a new project in the actual OS home even when HOME differs', () => {
    vi.spyOn(os, 'userInfo').mockReturnValue({ ...os.userInfo(), homedir: fixture });
    expect(() => ensureProject(fixture)).toThrow('run it inside the project');
    expect(fs.readdirSync(fixture)).toEqual([]);
  });

  it('refuses a new project in the system temp root', () => {
    vi.spyOn(os, 'tmpdir').mockReturnValue(fixture);
    expect(() => ensureProject(fixture)).toThrow('vibe will not create a project in the system temporary directory — run it inside the project');
    expect(fs.readdirSync(fixture)).toEqual([]);
  });

  it('preserves an existing home project and allows ordinary project folders', () => {
    vi.spyOn(os, 'homedir').mockReturnValue(fixture);
    const records = path.join(fixture, '.vibe');
    fs.mkdirSync(records);
    fs.writeFileSync(path.join(records, 'state.json'), '{"existing":true}');
    expect(() => ensureProject(fixture)).not.toThrow();
    expect(fs.readFileSync(path.join(records, 'state.json'), 'utf-8')).toBe('{"existing":true}');
    const project = path.join(fixture, 'project');
    fs.mkdirSync(project);
    expect(ensureProject(project)).toContain('.vibe');
    expect(fs.existsSync(path.join(project, '.vibe', 'state.json'))).toBe(true);
  });
});
