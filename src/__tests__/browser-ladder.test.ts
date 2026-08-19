/**
 * 브라우저 도구 우선순위 사다리의 계약.
 *
 * 실측한 사건: vibe 는 두 문서에서 Agent Browser 를 **1순위**로 못 박아 놓고
 * **얻는 방법은 어디에도 적지 않았다.** 검증 비용이 루프 횟수를 정하는데, 가장 싼
 * 수단을 아무도 설치하지 못하니 실제로는 전원이 2순위 Playwright 로 떨어졌다.
 *
 * 사다리는 선언이 아니라 **실행 가능**해야 의미가 있다. 그래서 고정할 것은 순서가
 * 아니라 "각 단이 도달 가능한가" 다.
 *
 * 두 문서가 갈라지는 것도 같이 막는다 — 하나만 고치면 에이전트와 스킬이 서로 다른
 * 사다리를 타게 되고, 그건 조용히 일어난다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const LADDERS = {
  'agents/e2e-tester.md': fs.readFileSync(path.join(ROOT, 'agents', 'e2e-tester.md'), 'utf-8'),
  'skills/vibe.run/references/e2e-and-autofix.md': fs.readFileSync(
    path.join(ROOT, 'skills', 'vibe.run', 'references', 'e2e-and-autofix.md'), 'utf-8'),
};

describe.each(Object.entries(LADDERS))('%s', (_file, text) => {
  it('1순위 도구를 지정한다', () => {
    expect(text).toMatch(/Agent Browser/);
  });

  /** 지정만 하고 얻는 법이 없으면 그 단은 존재하지 않는 것과 같다 */
  it('1순위 도구의 설치 경로를 적는다', () => {
    expect(text, 'Agent Browser 를 1순위로 두려면 설치 명령이 함께 있어야 한다')
      .toMatch(/agent-browser install/);
  });

  it('2순위 도구의 설치 경로도 적는다', () => {
    expect(text).toMatch(/playwright install/);
  });
});

/** 등장 순서 = 사다리 순서. 표기 차이(대소문자)는 정규화해 비교한다. */
function ladderOrder(text: string): string[] {
  const names = ['Agent Browser', 'Playwright Test Runner', 'Playwright test runner', 'Playwright MCP'];
  return names
    .map((name): [number, string] =>
      [text.indexOf(name), name.toLowerCase().replace(' test runner', ' runner')])
    .filter(([at]) => at !== -1)
    .sort((a, b) => a[0] - b[0])
    .map(([, name]) => name);
}

describe('두 문서의 사다리가 갈라지지 않는다', () => {
  const orders = Object.entries(LADDERS).map(([f, t]) => [f, ladderOrder(t)] as const);

  it('세 단이 모두 잡힌다 — 비교가 공허하지 않은지', () => {
    for (const [file, order] of orders) {
      expect(order, `${file}: 사다리 항목을 찾지 못했다`).toHaveLength(3);
    }
  });

  it('순서가 같다 — 갈라지면 에이전트와 스킬이 다른 길을 탄다', () => {
    const [[, a], [, b]] = orders;
    expect(a).toEqual(b);
    expect(a[0], '가장 싼 수단이 1순위여야 루프 횟수가 나온다').toBe('agent browser');
  });
});
