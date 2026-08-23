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
