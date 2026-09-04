import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkUpdate, installedVersion, newer, runUpdate } from './update.js';

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
