import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { hasNotifyHook, installHookFile, removeHookFile } from './hooks.js';

let root: string;
let file: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-windows-hooks-'));
  file = path.join(root, 'hooks.json');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
function windowsHooks() {
  const other = { hooks: [{ type: 'command', command: 'node "C:\\Other Tools\\notify.js"' }] };
  fs.writeFileSync(file, JSON.stringify({ hooks: { Stop: [
    { hooks: [{ type: 'command', command: 'node "C:\\Users\\이름 있는 사용자\\AppData\\Roaming\\npm\\node_modules\\@su-record\\vibe\\hooks\\notify.js" stop --personal' }] }, other,
  ] } }));
  return other;
}
it('recognizes and replaces Windows paths without accumulating old hooks', () => {
  const other = windowsHooks();
  expect(hasNotifyHook(file)).toBe(true);
  expect(installHookFile(file)).toBe('added');
  const hooks = JSON.parse(fs.readFileSync(file, 'utf8')).hooks;
  expect(hooks.Stop).toHaveLength(2);
  expect(hooks.Stop[0]).toEqual(other);
  expect(hooks.Stop[1].hooks[0].command).toContain('hooks/notify.js');
  expect(installHookFile(file)).toBe('unchanged');
});
it('removes the Windows Vibe hook and preserves another tool', () => {
  const other = windowsHooks();
  expect(removeHookFile(file)).toBe(true);
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).hooks.Stop).toEqual([other]);
  expect(hasNotifyHook(file)).toBe(false);
});

it('preserves another command in the same hook entry during migration and removal', () => {
  windowsHooks();
  const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  const other = settings.hooks.Stop.pop();
  settings.hooks.Stop[0].hooks.push(other.hooks[0]);
  fs.writeFileSync(file, JSON.stringify(settings));
  installHookFile(file);
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).hooks.Stop[0]).toEqual(other);
  expect(removeHookFile(file)).toBe(true);
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).hooks.Stop).toEqual([other]);
});
