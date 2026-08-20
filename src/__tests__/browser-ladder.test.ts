/**
 * 브라우저 도구 우선순위 사다리의 계약.
 *
 * 고정하는 것은 **순위 자체가 아니라 두 가지 성질**이다:
 *
 *   1. 사다리에 오른 도구는 **얻는 경로**가 함께 적혀 있을 것.
 *      한때 vibe 는 Agent Browser 를 1순위로 못 박아 놓고 얻는 방법을 어디에도
 *      적지 않았다 — 선언은 있는데 실행이 불가능한 상태였고, 실제로는 전원이
 *      아래 단으로 떨어졌다. 사다리는 선언이 아니라 실행 가능해야 의미가 있다.
 *   2. 두 문서가 **갈라지지 않을 것**. 하나만 고치면 에이전트와 스킬이 서로 다른
 *      사다리를 타게 되고, 그건 조용히 일어난다.
 *
 * 도구 선택 자체는 유지보수자의 결정이라 여기서 이름을 박지 않는다 — 박으면
 * 도구를 바꿀 때마다 테스트가 결정을 되돌리라고 요구한다.
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

/** 사다리에 이름이 오를 수 있는 도구와, 그 도구를 얻는 경로가 적혔는지 판정하는 규칙 */
const OBTAINABLE: ReadonlyArray<{ tool: RegExp; install: RegExp | null }> = [
  { tool: /Playwright (test runner|Test Runner)/, install: /playwright install/ },
  // MCP 계열은 하네스가 붙여주는 것이라 설치 명령이 없다 (null) — 사다리 최하단 전용
  { tool: /Playwright MCP/, install: null },
];

describe.each(Object.entries(LADDERS))('%s', (_file, text) => {
  it('사다리에 도구가 하나 이상 있다', () => {
    expect(OBTAINABLE.some(({ tool }) => tool.test(text))).toBe(true);
  });

  it('설치가 필요한 도구는 얻는 경로를 함께 적는다', () => {
    for (const { tool, install } of OBTAINABLE) {
      if (!tool.test(text) || install === null) continue;
      expect(install.test(text), `${tool.source} 를 올렸으면 설치 명령이 있어야 한다`)
        .toBe(true);
    }
  });

  /** 사다리의 존재 이유 — 이 문장이 빠지면 순서가 임의로 보인다 */
  it('비용이 순서를 정한다는 근거를 남긴다', () => {
    expect(text).toMatch(/비용|cost/);
  });
});

/** 등장 순서 = 사다리 순서 */
function ladderOrder(text: string): string[] {
  return OBTAINABLE
    .map(({ tool }): [number, string] => [text.search(tool), tool.source])
    .filter(([at]) => at !== -1)
    .sort((a, b) => a[0] - b[0])
    .map(([, name]) => name);
}

describe('두 문서의 사다리가 갈라지지 않는다', () => {
  const orders = Object.entries(LADDERS).map(([f, t]) => [f, ladderOrder(t)] as const);

  it('비교가 공허하지 않다 — 양쪽에서 같은 수의 단이 잡힌다', () => {
    const [[, a], [, b]] = orders;
    expect(a.length).toBeGreaterThan(1);
    expect(a.length).toBe(b.length);
  });

  it('순서가 같다 — 갈라지면 에이전트와 스킬이 다른 길을 탄다', () => {
    const [[, a], [, b]] = orders;
    expect(a).toEqual(b);
  });
});
