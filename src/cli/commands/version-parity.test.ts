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
import { describe, it, expect } from 'vitest';
import { formatVersionParity } from './upgrade.js';

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
