/**
 * skills.sh 설치 대상 검증.
 *
 * 이 검증기는 두 가지 일을 동시에 한다 — **셸 주입 차단**과 **표기 허용**. 후자가
 * 뒤처져 있었다: skills.sh 문서에는 설치 표기가 세 가지인데(실측) vibe 는 하나만
 * 받았다. 공식 문서를 그대로 따라 친 사용자가 "Invalid skill target" 을 받는다.
 *
 *   owner/repo                                 ← vibe 가 유일하게 받던 형태
 *   owner/repo@skill                           ← 단일 스킬 설치 (skills.sh 문서 표기)
 *   https://github.com/owner/repo              ← taste-skill 등 여러 배포처가 쓰는 형태
 *
 * 넓히되 화이트리스트는 유지한다 — 표기 세 가지를 여는 것이지 임의 문자열을
 * 통과시키는 것이 아니다. 주입 케이스를 함께 고정해 그 경계를 못 박는다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 검증을 통과한 대상은 실제 `npx skills add` 로 넘어간다 — 테스트가 네트워크를 타고
// 진짜로 스킬을 설치하면 안 된다. 호출 여부만 관측한다.
const execSync = vi.hoisted(() => vi.fn());
vi.mock('child_process', async (orig) => ({
  ...(await orig<typeof import('child_process')>()),
  execSync,
}));

import { skillsAdd } from './skills.js';

let exit: ReturnType<typeof vi.spyOn>;
let err: ReturnType<typeof vi.spyOn>;
let out: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  execSync.mockReset();
  exit = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('__exit__');
  }) as never);
  err = vi.spyOn(console, 'error').mockImplementation(() => {});
  out = vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

/** 검증 실패는 exit(1) 로 끝난다 — 실제 설치까지 가지 않는다 */
const rejected = (target: string): boolean => {
  try {
    skillsAdd(target);
    return false;
  } catch (e) {
    return (e as Error).message === '__exit__'
      && err.mock.calls.some((c) => String(c[0]).includes('Invalid skill target'));
  }
};

describe('skillsAdd — 설치 대상 검증', () => {
  it.each([
    'foo; rm -rf /',
    '$(whoami)/x',
    '`id`/y',
    'owner/repo && curl evil.sh',
    'http://evil.com/a/b',
    '../../etc/passwd',
  ])('주입 시도를 거부한다: %s', (target) => {
    expect(rejected(target)).toBe(true);
  });

  it.each([
    ['vercel-labs/agent-skills', '레포 전체'],
    ['vercel-labs/agent-skills@react-best-practices', '단일 스킬'],
    ['https://github.com/Leonxlnx/taste-skill', '전체 URL'],
  ])('문서에 있는 표기를 그대로 설치로 넘긴다: %s (%s)', (target) => {
    skillsAdd(target);
    expect(exit).not.toHaveBeenCalled();
    expect(execSync).toHaveBeenCalledTimes(1);
    expect(String(execSync.mock.calls[0][0])).toContain(target);
  });

  it('주입 시도는 설치까지 가지 않는다', () => {
    try { skillsAdd('owner/repo && curl evil.sh'); } catch { /* exit */ }
    expect(execSync, '검증 실패 후에도 명령이 실행되면 화이트리스트가 무의미하다')
      .not.toHaveBeenCalled();
  });

  it('인자가 없으면 사용법을 보여주고 실패시키지 않는다', () => {
    expect(() => skillsAdd()).not.toThrow();
    expect(out.mock.calls.some((c) => String(c[0]).includes('Usage'))).toBe(true);
    expect(exit).not.toHaveBeenCalled();
  });

  /** 사용법에 세 표기가 다 보여야 한다 — 문서가 곧 발견 경로다 */
  it('사용법이 단일 스킬 표기를 안내한다', () => {
    skillsAdd();
    expect(out.mock.calls.map((c) => String(c[0])).join('\n')).toContain('@react-best-practices');
  });
});
