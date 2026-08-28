import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { installCodexNotify } from './ProjectSetup.js';

const MANAGED_BLOCK = [
  '# >>> vibe notify (managed) — do not edit >>>',
  'notify = ["node", "C:/Users/endba/.vibe/hooks/scripts/codex-notify.js"]',
  '# <<< vibe notify (managed) <<<',
].join('\n');

// Codex computer-use 가 in-place 로 기록하는 형태 — vibe notify 를 --previous-notify 로 체인한다
const EXTERNAL_NOTIFY =
  'notify = [ "C:\\\\codex-computer-use.exe", "turn-ended", "--previous-notify", "[\\"node\\",\\"x.js\\"]" ]';

function makeConfigDir(contents?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-codex-notify-'));
  if (contents !== undefined) fs.writeFileSync(path.join(dir, 'config.toml'), contents);
  return dir;
}

function readConfig(dir: string): string {
  return fs.readFileSync(path.join(dir, 'config.toml'), 'utf-8');
}

function countNotifyKeys(toml: string): number {
  return (toml.match(/^\s*notify\s*=/gm) ?? []).length;
}

describe('installCodexNotify', () => {
  it('관리 블록 밖에 외부 notify 가 있으면 블록을 제거해 duplicate key 를 만들지 않는다', () => {
    const dir = makeConfigDir(`${MANAGED_BLOCK}\n\nmodel = "gpt-5.6-sol"\n${EXTERNAL_NOTIFY}\n`);

    installCodexNotify(dir);

    const result = readConfig(dir);
    expect(countNotifyKeys(result)).toBe(1);
    expect(result).not.toContain('vibe notify (managed)');
    expect(result).toContain('codex-computer-use.exe');
    expect(result).toContain('model = "gpt-5.6-sol"');
  });

  it('관리 블록만 있으면 갱신한다', () => {
    const dir = makeConfigDir(`${MANAGED_BLOCK}\n\nmodel = "gpt-5.6-sol"\n`);

    installCodexNotify(dir);

    const result = readConfig(dir);
    expect(countNotifyKeys(result)).toBe(1);
    expect(result).toContain('vibe notify (managed)');
    expect(result).toContain('codex-notify.js');
    expect(result).toContain('model = "gpt-5.6-sol"');
  });

  it('마커 없이 사용자 notify 만 있으면 건드리지 않는다', () => {
    const original = `model = "gpt-5.6-sol"\n${EXTERNAL_NOTIFY}\n`;
    const dir = makeConfigDir(original);

    installCodexNotify(dir);

    expect(readConfig(dir)).toBe(original);
  });

  it('config.toml 이 없으면 관리 블록으로 새로 만든다', () => {
    const dir = makeConfigDir();

    installCodexNotify(dir);

    const result = readConfig(dir);
    expect(countNotifyKeys(result)).toBe(1);
    expect(result).toContain('vibe notify (managed)');
  });
});
