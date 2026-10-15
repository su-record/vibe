import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { carryWiki, connectVault, obsidianRegistries, obsidianVaults, realFolder, syncedBy } from './obsidian.js';

let home: string;
const env = (): NodeJS.ProcessEnv => ({ XDG_CONFIG_HOME: path.join(home, '.config') });
const registry = (): string => path.join(home, '.config', 'obsidian', 'obsidian.json');
beforeEach(() => { home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-obsidian-'))); });
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));
function folder(name: string): string {
  const dir = path.join(home, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function register(vaults: Record<string, object>): void {
  fs.mkdirSync(path.dirname(registry()), { recursive: true });
  fs.writeFileSync(registry(), JSON.stringify({ vaults, updateDisabled: true }));
}

it('looks for the vault list where Obsidian keeps it on each platform', () => {
  expect(obsidianRegistries('/h', 'darwin', {})).toEqual([path.join('/h', 'Library', 'Application Support', 'obsidian', 'obsidian.json')]);
  expect(obsidianRegistries('/h', 'win32', { APPDATA: '/roaming' })).toEqual([path.join('/roaming', 'obsidian', 'obsidian.json')]);
  expect(obsidianRegistries('/h', 'win32', {})).toEqual([path.join('/h', 'AppData', 'Roaming', 'obsidian', 'obsidian.json')]);
  expect(obsidianRegistries('/h', 'linux', {})).toEqual([path.join('/h', '.config', 'obsidian', 'obsidian.json'),
    path.join('/h', '.var', 'app', 'md.obsidian.Obsidian', 'config', 'obsidian', 'obsidian.json')]);
  expect(obsidianRegistries('/h', 'linux', { XDG_CONFIG_HOME: '/xdg' })[0]).toBe(path.join('/xdg', 'obsidian', 'obsidian.json'));
});

it('lists existing vaults by real path, the open one first and then the most recent', () => {
  const [old, recent, open] = ['old', 'recent', 'open'].map(folder);
  register({ a: { path: old, ts: 1 }, b: { path: recent, ts: 9 }, c: { path: open, ts: 5, open: true },
    d: { path: path.join(home, 'gone'), ts: 99 }, e: { path: 'relative', ts: 99 }, f: { ts: 99 } });
  expect(obsidianVaults(home, 'linux', env()).map(v => v.path)).toEqual([open, recent, old]);
  expect(obsidianVaults(path.join(home, 'nobody'), 'linux', {})).toEqual([]);
});

it('names the service that copies a folder off the computer', () => {
  expect(syncedBy('/Users/me/Library/Mobile Documents/iCloud~md~obsidian/Documents/notes')).toBe('iCloud');
  expect(syncedBy('C:\\Users\\me\\OneDrive\\notes')).toBe('OneDrive');
  const vault = folder('vault');
  expect(syncedBy(path.join(vault, 'vibe'))).toBeNull();
  fs.mkdirSync(path.join(vault, '.obsidian'));
  fs.writeFileSync(path.join(vault, '.obsidian', 'core-plugins.json'), JSON.stringify(['file-explorer', 'sync']));
  expect(syncedBy(path.join(vault, 'vibe'))).toBe('Obsidian Sync');
  fs.writeFileSync(path.join(vault, '.obsidian', 'core-plugins.json'), JSON.stringify({ sync: false }));
  expect(syncedBy(path.join(vault, 'vibe'))).toBeNull();
});

it('stores a folder behind a link by its real path, even before it exists', () => {
  const real = folder('real-vault');
  if (process.platform === 'win32') return;
  fs.symlinkSync(real, path.join(home, 'linked'));
  expect(realFolder(path.join(home, 'linked', 'vibe', 'pages'))).toBe(path.join(real, 'vibe', 'pages'));
});

it('copies an earlier wiki only into an empty place, without links, overwrites or deletion', () => {
  const from = folder('from');
  fs.writeFileSync(path.join(from, 'index.md'), '- [[a]]');
  fs.mkdirSync(path.join(from, 'projects'));
  fs.writeFileSync(path.join(from, 'projects', 'a.md'), 'a');
  if (process.platform !== 'win32') fs.symlinkSync('/etc/hostname', path.join(from, 'linked.md'));
  const to = path.join(home, 'vault', 'vibe');
  expect(carryWiki(from, to)).toBe(2);
  expect(fs.readFileSync(path.join(to, 'projects', 'a.md'), 'utf8')).toBe('a');
  expect(fs.existsSync(path.join(to, 'linked.md'))).toBe(false);
  expect(fs.existsSync(path.join(from, 'index.md'))).toBe(true);
  fs.writeFileSync(path.join(from, 'index.md'), 'changed');
  expect(carryWiki(from, to)).toBe(0);
  expect(fs.readFileSync(path.join(to, 'index.md'), 'utf8')).toBe('- [[a]]');
  expect(carryWiki(from, from)).toBe(0);
  expect(carryWiki(path.join(home, 'none'), path.join(home, 'empty'))).toBe(0);
});

it('prepares the wiki as a vault, then lists it once Obsidian has run, keeping the rest of its settings', () => {
  const wiki = path.join(home, '.config', 'vibe', 'knowledge');
  expect(connectVault(wiki, home, 'linux', env())).toBe('waiting');
  expect(fs.statSync(path.join(wiki, '.obsidian')).isDirectory()).toBe(true);
  const own = folder('notes');
  register({ mine: { path: own, ts: 3, open: true } });
  expect(connectVault(wiki, home, 'linux', env())).toBe('connected');
  const doc = JSON.parse(fs.readFileSync(registry(), 'utf8'));
  expect(doc.updateDisabled).toBe(true);
  expect(doc.vaults.mine).toEqual({ path: own, ts: 3, open: true });
  expect(Object.values(doc.vaults).map(v => (v as { path: string }).path)).toEqual([own, wiki]);
  expect(connectVault(wiki, home, 'linux', env())).toBe('in-vault');
  expect(connectVault(path.join(own, 'vibe'), home, 'linux', env())).toBe('in-vault');
  fs.writeFileSync(registry(), '{broken');
  expect(connectVault(path.join(home, 'other'), home, 'linux', env())).toBe('waiting');
});
