/**
 * Codex notify 주입 계약.
 *
 * 실사용 장애: TOML 은 같은 키를 두 번 선언하면 **파싱 자체가 실패**해 codex 가
 * 통째로 뜨지 않는다. vibe 가 관리 블록을 넣은 뒤 다른 도구(codex-computer-use)가
 * 자기 notify 를 추가하면, 다음 `vibe upgrade` 가 블록만 보고 재작성해 매번 중복
 * 키를 만들었다 — 사용자가 손으로 지워도 upgrade 때마다 재발했다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { installCodexNotify } from './ProjectSetup.js';

let dir: string;
const configPath = (): string => path.join(dir, 'config.toml');
const read = (): string => fs.readFileSync(configPath(), 'utf-8');
const notifyCount = (): number => (read().match(/^\s*notify\s*=/gm) ?? []).length;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-codex-notify-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('installCodexNotify — 기본 동작', () => {
  it('config 가 없으면 관리 블록으로 생성한다', () => {
    installCodexNotify(dir);
    expect(notifyCount()).toBe(1);
    expect(read()).toContain('codex-notify.js');
  });

  it('반복 실행해도 키가 늘지 않는다 (idempotent)', () => {
    installCodexNotify(dir);
    installCodexNotify(dir);
    installCodexNotify(dir);
    expect(notifyCount()).toBe(1);
  });

  it('기존 설정을 보존한다', () => {
    fs.writeFileSync(configPath(), '[tui]\ntheme = "dark"\n');
    installCodexNotify(dir);
    expect(read()).toContain('theme = "dark"');
    expect(notifyCount()).toBe(1);
  });

  it('사용자가 이미 notify 를 정의했으면 주입하지 않는다', () => {
    fs.writeFileSync(configPath(), 'notify = ["my-own-script"]\n');
    installCodexNotify(dir);
    expect(notifyCount()).toBe(1);
    expect(read()).toContain('my-own-script');
    expect(read()).not.toContain('codex-notify.js');
  });
});

describe('외부 도구가 notify 를 추가한 뒤 (중복 키 회귀)', () => {
  /** vibe 주입 → 외부 도구가 자기 notify 추가 */
  function withExternalNotify(external: string): void {
    installCodexNotify(dir);
    fs.writeFileSync(configPath(), read() + `\n${external}\n`);
  }

  it('다음 upgrade 가 중복 키를 만들지 않는다', () => {
    withExternalNotify('notify = ["codex-computer-use", "turn-ended"]');
    installCodexNotify(dir);
    expect(notifyCount()).toBe(1);
  });

  it('외부 notify 를 남기고 vibe 블록을 양보한다', () => {
    withExternalNotify('notify = ["codex-computer-use", "turn-ended"]');
    installCodexNotify(dir);

    expect(read()).toContain('codex-computer-use');
    expect(read()).not.toContain('vibe notify (managed)');
  });

  it('--previous-notify 로 vibe 를 체인한 경우에도 체인이 보존된다', () => {
    // computer-use 는 우리 notify 를 인자로 감싸 이미 호출한다 — 지우면 안 되는 쪽은 이것
    withExternalNotify(
      'notify = "codex-computer-use turn-ended --previous-notify \\"[\\\\\\"node\\\\\\"]\\""',
    );
    installCodexNotify(dir);

    expect(notifyCount()).toBe(1);
    expect(read()).toContain('--previous-notify');
  });

  it('양보 후 다시 실행해도 안정적이다', () => {
    withExternalNotify('notify = ["codex-computer-use", "turn-ended"]');
    installCodexNotify(dir);
    installCodexNotify(dir);
    expect(notifyCount()).toBe(1);
  });

  it('외부 notify 주변의 다른 설정을 보존한다', () => {
    fs.writeFileSync(configPath(), '[tui]\ntheme = "dark"\n');
    installCodexNotify(dir);
    fs.writeFileSync(configPath(), 'notify = ["external"]\n' + read());

    installCodexNotify(dir);
    expect(notifyCount()).toBe(1);
    expect(read()).toContain('theme = "dark"');
  });
});
