/**
 * 전역 자산 갱신 판정 회귀.
 *
 * 실측 장애: npm 이 lifecycle script 를 건너뛰는 환경에서(`npm warn install-scripts`)
 * 전역 **패키지**만 새 버전이 되고 `~/.vibe/hooks/scripts/` 는 옛날 그대로였다.
 * 두 번의 릴리즈(v3.2.21 · v3.2.22) 동안 훅이 5일 전 상태였는데 `vibe upgrade` 는
 * 매번 "✅ vibe upgraded" 를 출력했다 — sentinel·scope·run-ledger·verify 가 전부
 * 구버전 코드로 도는데 사용자는 최신인 줄 알았다.
 *
 * 판정 근거: postinstall 이 패키지를 `~/.vibe/node_modules/@su-record/vibe` 로
 * 복사하므로, 그 사본의 버전이 마지막으로 postinstall 이 성공한 시점이다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createFakeHome, type FakeHome } from '../../test-helpers/index.js';

let fakeHome: FakeHome;
let home: string;

/** getCoreConfigDir 이 os.homedir() 을 따르므로 가짜 HOME 으로 격리한다 */
beforeEach(() => {
  fakeHome = createFakeHome('vibe-stale');
  home = fakeHome.path;
  vi.resetModules();
});

afterEach(() => {
  fakeHome.restore();
  vi.resetModules();
});

/** `~/.vibe/node_modules/@su-record/vibe/package.json` 에 사본 버전을 심는다 */
function writeCopiedVersion(version: string): void {
  const dir = path.join(home, '.vibe', 'node_modules', '@su-record', 'vibe');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version }), 'utf-8');
}

const load = async (): Promise<typeof import('./upgrade.js')> => import('./upgrade.js');

describe('staleGlobalAssets', () => {
  it('사본 버전이 설치 버전과 같으면 최신이다', async () => {
    writeCopiedVersion('3.2.22');
    const { staleGlobalAssets } = await load();
    expect(staleGlobalAssets('3.2.22')).toBeNull();
  });

  it('사본이 뒤처져 있으면 그 버전을 돌려준다 — 이것이 실측 장애 형태다', async () => {
    writeCopiedVersion('3.2.20');
    const { staleGlobalAssets } = await load();
    expect(staleGlobalAssets('3.2.22')).toBe('3.2.20');
  });

  it('사본이 아예 없으면 none', async () => {
    const { staleGlobalAssets } = await load();
    expect(staleGlobalAssets('3.2.22')).toBe('none');
  });

  it('사본 package.json 이 손상돼도 던지지 않는다 (fail-open)', async () => {
    const dir = path.join(home, '.vibe', 'node_modules', '@su-record', 'vibe');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), '{ broken', 'utf-8');

    const { staleGlobalAssets } = await load();
    expect(staleGlobalAssets('3.2.22')).toBe('none');
  });

  it('version 필드가 없으면 unknown', async () => {
    const dir = path.join(home, '.vibe', 'node_modules', '@su-record', 'vibe');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), '{}', 'utf-8');

    const { staleGlobalAssets } = await load();
    expect(staleGlobalAssets('3.2.22')).toBe('unknown');
  });

  it('사본이 앞서 있어도 불일치로 본다 (다운그레이드도 갱신 대상)', async () => {
    writeCopiedVersion('3.3.0');
    const { staleGlobalAssets } = await load();
    expect(staleGlobalAssets('3.2.22')).toBe('3.3.0');
  });
});
