/**
 * `vibe plugin` — npm 설치 사용자용 플러그인 경로.
 *
 * 실측으로 드러난 두 제약을 고정한다:
 *
 *  1. `source.path` 는 **마켓플레이스 루트 기준 `./` 상대 경로**여야 한다.
 *     절대 경로를 넣으면 `marketplace add` 는 통과하지만 `plugin add` 가
 *     "not found in marketplace" 로 실패한다.
 *  2. 조립본에 `node_modules` 가 들어가면 안 된다. Codex 는 source.path 를 통째로
 *     캐시에 복사하는데, 전역 패키지는 312MB 중 304MB 가 node_modules 였다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createFakeHome, type FakeHome } from '../../test-helpers/index.js';

let fakeHome: FakeHome;
let home: string;

beforeEach(() => {
  fakeHome = createFakeHome('vibe-plugin');
  home = fakeHome.path;
  vi.resetModules();   // getCoreConfigDir 이 HOME 을 캐시할 수 있다
});

afterEach(() => {
  fakeHome.restore();
});

const load = async (): Promise<typeof import('./plugin.js')> => import('./plugin.js');

const marketplaceFile = (): string =>
  path.join(home, '.agents', 'plugins', 'marketplace.json');

const readMarketplace = (): { plugins: Array<{ name: string; source: { path: string } }> } =>
  JSON.parse(fs.readFileSync(marketplaceFile(), 'utf-8')) as never;

describe('vibe plugin install', () => {
  it('마켓플레이스를 홈 아래에 만든다', async () => {
    const { pluginInstall } = await load();
    pluginInstall();
    expect(fs.existsSync(marketplaceFile())).toBe(true);
  });

  it('source.path 가 ./ 상대 경로다 — 절대 경로면 plugin add 가 실패한다', async () => {
    const { pluginInstall } = await load();
    pluginInstall();

    const src = readMarketplace().plugins.find((p) => p.name === 'vibe')!.source;
    expect(src.path).toMatch(/^\.\//);
    expect(src.path, '절대 경로는 marketplace 에서 조회되지 않는다').not.toMatch(/^\//);
  });

  it('조립본에 node_modules 가 없다', async () => {
    const { pluginInstall } = await load();
    pluginInstall();
    expect(fs.existsSync(path.join(home, '.vibe', 'plugin', 'vibe', 'node_modules'))).toBe(false);
  });

  it('매니페스트와 스킬이 조립된다', async () => {
    const { pluginInstall } = await load();
    pluginInstall();

    const root = path.join(home, '.vibe', 'plugin', 'vibe');
    expect(fs.existsSync(path.join(root, '.codex-plugin', 'plugin.json'))).toBe(true);
    expect(fs.readdirSync(path.join(root, 'skills')).length).toBeGreaterThan(0);
  });

  it('기존 마켓플레이스 항목을 보존한다', async () => {
    fs.mkdirSync(path.dirname(marketplaceFile()), { recursive: true });
    fs.writeFileSync(marketplaceFile(), JSON.stringify({
      name: 'mine',
      plugins: [{ name: 'other', source: { source: 'local', path: './other' } }],
    }));

    const { pluginInstall } = await load();
    pluginInstall();

    const names = readMarketplace().plugins.map((p) => p.name);
    expect(names).toContain('other');
    expect(names).toContain('vibe');
  });

  it('두 번 실행해도 항목이 중복되지 않는다', async () => {
    const { pluginInstall } = await load();
    pluginInstall();
    pluginInstall();
    expect(readMarketplace().plugins.filter((p) => p.name === 'vibe')).toHaveLength(1);
  });

  it('손상된 마켓플레이스 파일도 복구한다', async () => {
    fs.mkdirSync(path.dirname(marketplaceFile()), { recursive: true });
    fs.writeFileSync(marketplaceFile(), '{ broken');

    const { pluginInstall } = await load();
    expect(() => pluginInstall()).not.toThrow();
    expect(readMarketplace().plugins.some((p) => p.name === 'vibe')).toBe(true);
  });
});
