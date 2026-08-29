/**
 * 선언한 릴리즈 게이트는 CI 에서 돌아야 한다.
 *
 * 실측: CLAUDE.md 가 릴리즈 게이트 7종을 표로 선언해 두고, CI 는 그중 **넷만**
 * 돌리고 있었다. 나머지 넷(`gen:skill-docs:check`·`validate:counts`·
 * `validate:skill-invocation`·`sync:agent-models:check`)은 사람이 릴리즈 때마다
 * 손으로 돌리는 것에 의존했다.
 *
 * 이 세션 내내 통과한 이유는 매번 손으로 돌렸기 때문이고, 그건 시스템이 아니라
 * 습관이다. **아무도 안 돌리는 가드는 아무것도 잡지 못한다** — 다른 사람의 PR 이나
 * 잊은 릴리즈 한 번이면 그대로 새어 나간다.
 *
 * 그래서 고정하는 것은 "게이트가 존재한다" 가 아니라 **"선언과 실행이 일치한다"** 다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const CLAUDE_MD = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf-8');
const WORKFLOWS = fs
  .readdirSync(path.join(ROOT, '.github', 'workflows'))
  .filter((f) => f.endsWith('.yml'))
  .map((f) => fs.readFileSync(path.join(ROOT, '.github', 'workflows', f), 'utf-8'))
  .join('\n');

/** CLAUDE.md 의 "Release Gates" 표에서 npm 스크립트 이름을 뽑는다 */
function declaredGates(): string[] {
  const start = CLAUDE_MD.indexOf('### Release Gates');
  expect(start, 'CLAUDE.md 에 Release Gates 절이 없다').toBeGreaterThan(-1);
  const section = CLAUDE_MD.slice(start, CLAUDE_MD.indexOf('\n###', start + 3));
  return [...section.matchAll(/npm run ([a-z][a-z0-9:-]+)/g)]
    .map((m) => m[1])
    .filter((name) => name !== 'build');
}

describe('릴리즈 게이트', () => {
  const gates = declaredGates();

  it('선언된 게이트가 여러 개 잡힌다 — 파싱이 공허하지 않은지', () => {
    expect(gates.length).toBeGreaterThan(3);
  });

  it.each(gates)('%s 가 CI 워크플로에서 실행된다', (gate) => {
    expect(WORKFLOWS, `선언만 하고 CI 에서 안 돌면 사람의 습관에 의존하게 된다`)
      .toContain(gate);
  });

  it('테스트도 CI 에서 돈다', () => {
    expect(WORKFLOWS).toMatch(/pnpm test/);
  });
});

/**
 * 게이트가 CI 에서 도는 것만으로는 부족하다 — **개발자 기계에서도 같은 답을 내야** 한다.
 *
 * 실측 2026-08-29: 생성물 검증 게이트 셋(`gen:skill-docs:check`,
 * `gen:plugin-hooks:check`, `sync:agent-models:check`)이 Windows 에서 상시 exit 1
 * 이었다. 재생성해도 `git diff --ignore-cr-at-eol` 은 완전히 비어 있었다 — 내용이
 * 아니라 EOL 만 달랐다. 세 게이트 모두 메모리에서 만든 문자열(LF)과 디스크 파일을
 * 직접 비교하는데, core.autocrlf=true 면 체크아웃이 CRLF 라서 항상 어긋난다.
 *
 * **항상 빨간 게이트는 꺼진 게이트다.** 로컬에서 늘 실패하면 실패를 읽지 않게 되고,
 * 그 상태에서 진짜 드리프트가 섞여 들어와도 구분되지 않는다.
 */
describe('게이트 결정성 — EOL', () => {
  const ATTRS = path.join(ROOT, '.gitattributes');

  it('.gitattributes 가 작업 트리 EOL 을 LF 로 고정한다', () => {
    expect(fs.existsSync(ATTRS), '이 파일이 없으면 Windows 체크아웃이 CRLF 가 된다').toBe(true);
    expect(fs.readFileSync(ATTRS, 'utf-8'), 'core.autocrlf 를 무력화하는 규칙이 필요하다')
      .toMatch(/^\*\s+text=auto\s+eol=lf$/m);
  });

  it('생성물 파일이 실제로 LF 로 저장돼 있다', () => {
    // 규칙만 있고 작업 트리가 재정규화되지 않았으면 게이트는 여전히 빨갛다.
    const generated = [
      'SKILL-CATALOG.md',
      'hooks/plugin-hooks.json',
      'hooks/claude-plugin-hooks.json',
      'plugins/vibe/dist/cli/detect.js',
    ];
    for (const rel of generated) {
      const body = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
      expect(body.includes('\r\n'), `${rel} 에 CRLF 가 남아 있다`).toBe(false);
    }
  });

  it('tsc 가 LF 로 산출한다 — 배포 트리 바이트가 빌드한 OS 에 의존하지 않게', () => {
    // newLine 을 비워두면 tsc 는 플랫폼 기본값을 쓴다. plugins/vibe/dist 는 **커밋되는**
    // 산출물이라, 그대로 두면 누가 빌드했느냐에 따라 배포 트리 바이트가 달라진다.
    expect(fs.readFileSync(path.join(ROOT, 'tsconfig.json'), 'utf-8'))
      .toMatch(/"newLine":\s*"lf"/);
  });
});
