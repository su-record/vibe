/**
 * 외부 스킬 매핑의 경계.
 *
 * 스킬은 하나하나가 매 세션 상시 컨텍스트다(`vibe status` 의 Skills 행이 총량을
 * 보고한다). 그래서 "무엇을 묻지 않고 얹는가" 가 설계 결정이 된다:
 *
 *   스택 매핑        → 묻지 않고 설치 (스택을 감지했으면 필요한 것이 확실하다)
 *   capability 매핑  → 사용자가 `vibe init` 에서 **고른 경우에만**
 *   그 외            → 스킬 본문에서 권유만 (taste-skill 등)
 *
 * 이 경계가 무너지면 사용자는 init 한 번에 컨텍스트가 얼마나 늘었는지 모른 채
 * 비용을 치른다. 여기서 고정한다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  resolveExternalSkills,
  CAPABILITY_EXTERNAL_SKILLS,
  AVAILABLE_CAPABILITIES,
} from './constants.js';

const ROOT = path.resolve(__dirname, '..', '..', '..');

describe('capability 외부 스킬', () => {
  it('고르지 않으면 아무것도 설치하지 않는다', () => {
    expect(resolveExternalSkills([], [])).toEqual([]);
  });

  it('고른 capability 의 스킬만 나온다', () => {
    expect(resolveExternalSkills([], ['mcp'])).toEqual(['anthropics/skills@mcp-builder']);
  });

  it('모르는 capability 는 조용히 무시한다 — 설치를 실패시키지 않는다', () => {
    expect(resolveExternalSkills([], ['nonexistent'])).toEqual([]);
  });

  /** init 프롬프트에 없으면 사용자가 고를 수 없다 — 매핑만 있고 선택지가 없으면 죽은 코드다 */
  it.each(Object.keys(CAPABILITY_EXTERNAL_SKILLS))(
    '%s 는 init 에서 고를 수 있다',
    (cap) => {
      expect(AVAILABLE_CAPABILITIES.map((c) => c.value)).toContain(cap);
    },
  );

  /** v3.2.38 이전 검증기는 `@skill` 표기를 거부했다 — 매핑이 그 표기를 쓰므로 함께 고정한다 */
  it.each(Object.values(CAPABILITY_EXTERNAL_SKILLS).flat())(
    '%s 가 설치 대상 검증을 통과하는 형태다',
    (target) => {
      expect(target).toMatch(/^(https:\/\/github\.com\/)?[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(@[a-zA-Z0-9_.-]+)?$/);
    },
  );
});

/**
 * taste-skill 은 **권유만** 한다. 자동 설치 목록에 들어가면 사용자가 고르지 않은
 * 3rd-party 스킬이 머신에 얹힌다 — 신뢰 결정은 사람이 해야 한다.
 */
describe('taste-skill 은 자동 설치하지 않는다', () => {
  const design = fs.readFileSync(
    path.join(ROOT, 'skills', 'vibe.design', 'SKILL.md'), 'utf-8');
  const constants = fs.readFileSync(
    path.join(ROOT, 'src', 'cli', 'postinstall', 'constants.ts'), 'utf-8');

  it('vibe.design 이 설치 명령을 안내한다', () => {
    expect(design).toContain('taste-skill');
    expect(design, '통째로 받으면 컨텍스트가 늘어난다 — 하나만 집는 형태로 안내한다')
      .toContain('--skill');
  });

  it('자동 설치 매핑에는 들어 있지 않다', () => {
    expect(constants.toLowerCase()).not.toContain('taste-skill');
  });

  it('권유를 1회로 제한한다고 명시한다', () => {
    expect(design).toMatch(/1회|한 번/);
  });
});
