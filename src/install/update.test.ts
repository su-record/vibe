import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkUpdate, installedVersion, newer, runUpdate, syncUpdatedIntegrations } from './update.js';

let dir: string;
let savedPath: string | undefined;
function shimNpm(latest: string, failInstall = false): void {
  fs.writeFileSync(path.join(dir, 'npm'), `#!/bin/sh\necho "$@" >> "${dir}/npm.log"\ncase "$1" in view) echo "${latest}";; i) ${failInstall ? 'echo boom >&2; exit 1' : 'exit 0'};; esac\n`, { mode: 0o755 });
}
const log = (): string[] => (fs.existsSync(path.join(dir, 'npm.log')) ? fs.readFileSync(path.join(dir, 'npm.log'), 'utf-8').trim().split('\n') : []);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-update-'));
  savedPath = process.env['PATH'];
  process.env['PATH'] = `${dir}:${savedPath ?? ''}`;
});
afterEach(() => {
  process.env['PATH'] = savedPath;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('vibe update — an npm install the user does not have to know about', () => {
  it('runs the npm-installed CLI setup, forwards a spaced home path and verifies stale or wrong versions', () => {
    const globalRoot = path.join(dir, 'global modules');
    const cli = path.join(globalRoot, '@su-record/vibe/dist/cli.js');
    fs.mkdirSync(path.dirname(cli), { recursive: true });
    fs.writeFileSync(path.join(dir, 'npm'), `#!/bin/sh\nprintf '%s\\n' '${globalRoot}'\n`, { mode: 0o755 });
    const write = (version: string, current: boolean, code = 0): void => {
      fs.writeFileSync(cli, `require('fs').writeFileSync(${JSON.stringify(path.join(dir, 'args.json'))}, JSON.stringify(process.argv.slice(2))); console.log(${JSON.stringify(JSON.stringify({ version, clients: { claude: { current }, codex: { current } } }))}); process.exitCode=${code};`);
    };
    write('99.0.0', true);
    expect(syncUpdatedIntegrations('99.0.0', path.join(dir, 'user home')).ok).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'args.json'), 'utf8'))).toEqual(['setup', '--json', '--home', path.join(dir, 'user home')]);
    write('99.0.0', false);
    expect(syncUpdatedIntegrations('99.0.0')).toMatchObject({ ok: false, detail: expect.stringContaining('claude, codex') });
    write('98.0.0', true);
    expect(syncUpdatedIntegrations('99.0.0').ok).toBe(false);
    write('99.0.0', true, 1);
    expect(syncUpdatedIntegrations('99.0.0').ok).toBe(false);
    fs.writeFileSync(cli, 'console.log("not json")');
    expect(syncUpdatedIntegrations('99.0.0').ok).toBe(false);
  });

  it('update: compares versions, installs only when the registry is newer, and reports a failed install with the manual command', () => {
    expect(newer('4.1.1', '4.1.0')).toBe(true);
    expect(newer('4.1.0', '4.1.0')).toBe(false);
    expect(newer('4.0.9', '4.1.0')).toBe(false);
    const here = installedVersion();
    shimNpm(here);
    expect(checkUpdate()).toEqual({ installed: here, latest: here, available: false });
    expect(runUpdate()).toMatchObject({ updated: false, detail: `already current (${here})` });
    expect(log()).toEqual([`view @su-record/vibe version`, `view @su-record/vibe version`]);

    shimNpm('99.0.0');
    const r = runUpdate();
    expect(r).toMatchObject({ updated: true, latest: '99.0.0', detail: `${here} → 99.0.0` });
    expect(log().at(-1)).toBe('i -g @su-record/vibe@99.0.0');

    shimNpm('99.0.0', true);
    expect(runUpdate()).toMatchObject({ updated: false, detail: expect.stringContaining('npm i -g @su-record/vibe@99.0.0') });
  });

  it('update: no registry means no verdict about versions', () => {
    fs.writeFileSync(path.join(dir, 'npm'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    expect(checkUpdate()).toMatchObject({ latest: null, available: false });
    expect(runUpdate().detail).toContain('registry could not be reached');
  });
});
