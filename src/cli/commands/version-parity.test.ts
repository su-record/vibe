/**
 * 업그레이드가 **도달했는지** 확인한다.
 *
 * 실측 제보: macOS 에서 `vibe upgrade` 가 "✅ vibe upgraded (v2.9.37)" 를 출력했는데
 * 레지스트리 latest 는 v3.2.44 였다 — **40 릴리즈 뒤처진 채 성공이라고 말한 것**이다.
 * `npm install -g …@latest` 는 exit 0 으로 끝났고, 설치본 버전도 디스크에서 제대로
 * 읽었다. 빠진 것은 **비교** 하나였다.
 *
 * 전역 자산(v3.2.23)·네이티브 바인딩(v3.2.29)·프로젝트 훅(v3.2.36)에서 고친 것과
 * 같은 형태다: 결과를 확인하지 않으면 성공 보고는 아무것도 보장하지 않는다.
 *
 * 원인은 머신마다 다르므로(Node engines, npm prefix 불일치, 미러) 여기서 단정하지
 * 않는다. 단정 대신 **판별에 필요한 사실**을 준다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const execSyncMock = vi.hoisted(() => vi.fn());
vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  execSync: execSyncMock,
}));

import {
  formatVersionParity,
  scopeRegistryOverride,
  registryLatest,
  PUBLISH_REGISTRY,
} from './upgrade.js';

beforeEach(() => {
  execSyncMock.mockReset();
});

describe('formatVersionParity', () => {
  it('최신이면 아무 말도 하지 않는다 — 조용할 때는 조용해야 한다', () => {
    expect(formatVersionParity('3.2.44', '3.2.44')).toBe('');
  });

  it('레지스트리를 못 읽으면 판정하지 않는다 — 오프라인을 실패로 읽지 않는다', () => {
    expect(formatVersionParity('3.2.44', null)).toBe('');
  });

  it('뒤처졌으면 두 버전을 나란히 보여준다', () => {
    const out = formatVersionParity('2.9.37', '3.2.44');
    expect(out).toContain('2.9.37');
    expect(out).toContain('3.2.44');
  });

  /** 가장 흔한 원인이 Node 요구사항 불일치와 prefix 불일치다 — 단정 말고 사실을 준다 */
  it('판별에 필요한 사실을 함께 준다', () => {
    const out = formatVersionParity('2.9.37', '3.2.44');
    expect(out, 'Node 버전과 요구사항').toContain(process.version);
    expect(out, 'PATH 와 npm prefix 대조').toContain('npm prefix -g');
    expect(out).toContain('which -a vibe');
  });

  it('원인을 단정하지 않는다 — 머신마다 다르다', () => {
    const out = formatVersionParity('2.9.37', '3.2.44');
    expect(out).not.toMatch(/때문입니다|원인은 .* 입니다/);
  });

  /** 성공으로 읽히면 안 된다 — 이 사건의 핵심이 "성공이라고 말한 것" 이었다 */
  it('경고 표식을 쓴다', () => {
    expect(formatVersionParity('2.9.37', '3.2.44')).toContain('⚠️');
  });
});

/**
 * 판정이 **사용자 설정된 레지스트리에 좌우되면** 탐지가 필요한 바로 그 상황에서만
 * 침묵한다. 실측(v3.2.46): `~/.npmrc` 의
 * `@su-record:registry=https://npm.pkg.github.com` 때문에 upgrade 가 v2.9.37 에
 * 머물렀는데, 같은 미러를 보던 위 패리티 판정은 아무 말도 하지 않았다 —
 * 설치본도 2.9.37, 미러가 말하는 latest 도 2.9.37 이었기 때문이다.
 *
 * 스코프 레지스트리는 `--registry` 플래그보다 우선한다(실측). 덮으려면 스코프 키를
 * 직접 지정해야 한다.
 */
describe('스코프 레지스트리 오버라이드', () => {
  it('발행처와 다른 곳을 가리키면 오버라이드다', () => {
    expect(scopeRegistryOverride('https://npm.pkg.github.com')).toBe('https://npm.pkg.github.com');
  });

  it('발행처와 같은 곳이면 오버라이드가 아니다 — 후행 슬래시도 같은 곳이다', () => {
    expect(scopeRegistryOverride(PUBLISH_REGISTRY)).toBeNull();
    expect(scopeRegistryOverride(`${PUBLISH_REGISTRY}/`)).toBeNull();
  });

  /** `npm config get` 은 설정이 없을 때 문자열 "undefined" 를 출력한다 (실측) */
  it('설정이 없으면 오버라이드가 아니다', () => {
    for (const empty of [null, undefined, '', '  ', 'undefined', 'null']) {
      expect(scopeRegistryOverride(empty), String(empty)).toBeNull();
    }
  });

  it('오버라이드가 있으면 그 사실과 조치를 준다 — 읽어서 아는 사실이라 단정할 수 있다', () => {
    const out = formatVersionParity('2.9.37', '3.2.46', 'https://npm.pkg.github.com');
    expect(out, '어디를 가리키는지').toContain('https://npm.pkg.github.com');
    expect(out, '되돌리는 방법').toContain('npm config delete @su-record:registry');
  });

  /** 이 설정이 있으면 다른 후보를 아무리 고쳐도 안 고쳐진다 — 먼저 읽혀야 한다 */
  it('오버라이드를 다른 원인 후보보다 먼저 놓는다', () => {
    const out = formatVersionParity('2.9.37', '3.2.46', 'https://npm.pkg.github.com');
    expect(out.indexOf('@su-record 스코프')).toBeLessThan(out.indexOf('npm prefix -g'));
  });

  it('오버라이드가 없으면 그 얘기를 꺼내지 않는다', () => {
    expect(formatVersionParity('2.9.37', '3.2.46')).not.toContain('@su-record 스코프');
  });
});

/** 불변식: 최신의 기준은 **발행처**다 — 어느 URL 인지는 SSOT 에서 읽는다 */
describe('registryLatest', () => {
  it('사용자 스코프 설정을 덮고 발행처에 묻는다', () => {
    const calls: string[] = [];
    execSyncMock.mockImplementation((cmd: string) => {
      calls.push(cmd);
      return '3.2.46\n';
    });

    expect(registryLatest()).toBe('3.2.46');
    expect(calls[0], '스코프 키를 직접 덮어야 한다 — --registry 로는 안 덮인다')
      .toContain(`--@su-record:registry=${PUBLISH_REGISTRY}`);
  });

  it('조회에 실패하면 판정하지 않는다 — 오프라인을 실패로 읽지 않는다', () => {
    execSyncMock.mockImplementation(() => { throw new Error('offline'); });
    expect(registryLatest()).toBeNull();
  });
});
