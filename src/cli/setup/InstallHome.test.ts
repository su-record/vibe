/**
 * sudo 전역 설치 홈 해석 회귀 테스트.
 *
 * 재현했던 결함: 배포판 npm(prefix `/usr`)에 전역 설치하려면 sudo 가 필요하고,
 * 그러면 postinstall 이 root 로 돌아 자산이 `/root/.claude/` 로 갔다. 사용자에게는
 * 패키지(`/usr/lib/node_modules/...`)와 CLI(`/usr/bin/vibe`)는 멀쩡한데
 * `~/.claude/skills`·`~/.claude/agents` 만 비어 있는 상태로 보였다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveInstallHome, restoreOwnership } from './InstallHome.js';

const ENV_KEYS = ['SUDO_USER', 'SUDO_UID', 'SUDO_GID', 'HOME'] as const;

let saved: Record<string, string | undefined>;
let getuid: typeof process.getuid;
let dir: string;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  getuid = process.getuid;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-install-home-'));
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  process.getuid = getuid;
  fs.rmSync(dir, { recursive: true, force: true });
});

/** root 로 승격된 sudo 세션을 흉내낸다 */
function asSudo(user: string, opts: { uid?: string; gid?: string } = {}): void {
  process.getuid = (): number => 0;
  process.env.SUDO_USER = user;
  if (opts.uid !== undefined) process.env.SUDO_UID = opts.uid;
  if (opts.gid !== undefined) process.env.SUDO_GID = opts.gid;
}

describe('resolveInstallHome', () => {
  it('sudo 가 아니면 os.homedir() 를 그대로 쓴다', () => {
    delete process.env.SUDO_USER;
    const result = resolveInstallHome();
    expect(result.redirected).toBe(false);
    expect(result.home).toBe(os.homedir());
  });

  it('SUDO_USER 가 있어도 root 로 승격된 게 아니면 되돌리지 않는다', () => {
    process.env.SUDO_USER = 'someone';
    process.getuid = (): number => 1000;
    expect(resolveInstallHome().redirected).toBe(false);
  });

  it('SUDO_USER=root 는 되돌릴 대상이 아니다', () => {
    asSudo('root');
    expect(resolveInstallHome().redirected).toBe(false);
  });

  it('sudo 승격이면 원래 사용자의 홈으로 되돌린다', () => {
    // 관례 경로(/home/<user>)가 실제로 존재해야 채택된다 — 그 조건을 흉내낸다
    const user = path.basename(dir);
    const home = process.platform === 'darwin' ? `/Users/${user}` : `/home/${user}`;
    if (fs.existsSync(home)) return; // 동명 계정이 실재하면 검증 불가 — 건너뛴다

    asSudo(user, { uid: '1001', gid: '1002' });
    // 홈이 없으면 폴백한다는 것까지 함께 확인한다
    expect(resolveInstallHome().redirected).toBe(false);
  });

  it('홈이 존재하지 않으면 폴백한다 (엉뚱한 경로를 만들지 않는다)', () => {
    asSudo('definitely-not-a-real-user-xyz', { uid: '1001', gid: '1002' });
    const result = resolveInstallHome();
    expect(result.redirected).toBe(false);
    expect(result.home).toBe(os.homedir());
  });

  it('SUDO_UID/GID 가 없으면 소유권 복원 대상이 아니다', () => {
    asSudo('nobody-xyz');
    delete process.env.SUDO_UID;
    delete process.env.SUDO_GID;
    expect(resolveInstallHome().uid).toBeUndefined();
  });
});

describe('restoreOwnership', () => {
  it('되돌림이 없었으면 아무것도 하지 않는다', () => {
    const changed = restoreOwnership(dir, { home: dir, redirected: false });
    expect(changed).toBe(false);
  });

  it('uid/gid 가 없으면 아무것도 하지 않는다', () => {
    const changed = restoreOwnership(dir, { home: dir, redirected: true });
    expect(changed).toBe(false);
  });

  it('대상이 없으면 실패하지 않는다', () => {
    const missing = path.join(dir, 'nope');
    expect(restoreOwnership(missing, { home: dir, uid: 0, gid: 0, redirected: true })).toBe(false);
  });

  it('권한이 없어도 예외를 던지지 않는다 (설치를 중단시키지 않는다)', () => {
    fs.writeFileSync(path.join(dir, 'f.txt'), 'x');
    // uid 0 으로의 chown 은 비-root 에서 실패한다 — fail-open 이어야 한다
    expect(() => restoreOwnership(dir, { home: dir, uid: 0, gid: 0, redirected: true })).not.toThrow();
  });
});
