/**
 * 신호 수집기·비용 게이트는 **의존성 없이** 로드돼야 한다.
 *
 * 실측한 사건: GPT 앱에서 "Vibe 신호 수집기의 통합 진입점이 선택 기능과 무관한
 * papaparse 누락으로 실패" 가 반복 발생했다. 원인은 두 겹이다:
 *
 *   1. 스킬 문서가 신호 수집기를 `dist/tools/index.js` — 모든 기능을 재수출하는
 *      **통합 배럴** — 을 통해 불렀다. 값싼 신호 하나를 얻으려고 papaparse·
 *      better-sqlite3 등 전 기능의 의존성 해석을 강제한 셈이다.
 *   2. 플러그인 트리에는 `node_modules` 가 없다(의도된 설계). 그래서 배럴이 죽었다.
 *
 * 신호 수집기와 비용 게이트는 **게이트**다 — 게이트가 환경 때문에 죽으면 폭주
 * 방어가 통째로 사라진다. 그것도 조용히. 그래서 이 둘만큼은 노드 빌트인 외에
 * 아무것도 요구하지 않아야 한다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const DISPATCH = path.join(ROOT, 'src', 'tools', 'dispatch');

/** 이 디렉토리에서 도달 가능한 소스 전부 (상대 import 를 따라간다) */
function reachableSources(entry: string): string[] {
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file) || !fs.existsSync(file)) return;
    seen.add(file);
    for (const m of fs.readFileSync(file, 'utf-8').matchAll(/from\s+'(\.[^']+)'/g)) {
      walk(path.resolve(path.dirname(file), m[1].replace(/\.js$/, '.ts')));
    }
  };
  walk(entry);
  return [...seen];
}

/** 노드 빌트인 — 이건 어디서나 있다 */
const BUILTINS = new Set([
  'fs', 'path', 'os', 'url', 'crypto', 'child_process', 'util', 'module',
  'node:fs', 'node:path', 'node:os', 'node:url', 'node:crypto', 'node:module',
]);

const sources = reachableSources(path.join(DISPATCH, 'index.ts'))
  .filter((f) => !f.endsWith('.test.ts'));

describe('dispatch 배럴은 의존성 프리다', () => {
  it('진입점에서 도달 가능한 소스가 있다 (탐색 자체가 죽지 않았는지)', () => {
    expect(sources.length).toBeGreaterThan(1);
  });

  it.each(sources.map((f) => [path.relative(ROOT, f), f]))(
    '%s 가 외부 패키지를 import 하지 않는다',
    (_rel, file) => {
      const external = [...fs.readFileSync(file, 'utf-8').matchAll(/from\s+'([^'.][^']*)'/g)]
        .map((m) => m[1])
        .filter((spec) => !BUILTINS.has(spec));
      expect(external, `게이트가 외부 의존성을 요구하면 node_modules 없는 환경에서 죽는다`)
        .toEqual([]);
    },
  );
});

/**
 * 두 번째 겹: 호출 경로. 배럴이 깨끗해도 스킬 문서가 통합 배럴로 부르면 같은 일이 난다.
 */
describe('스킬 문서가 게이트를 통합 배럴로 부르지 않는다', () => {
  // `validateLoopDefinition` 도 게이트다 — 루프 정의가 유효해야 install/run 을 허용한다.
  // 통합 배럴로 부르면 node_modules 없는 환경(플러그인 트리)에서 게이트가 죽는다.
  const GATE_FNS = [
    'collectDispatchSignals', 'detectResumeState', 'detectStakesSignals',
    'classifyUrl', 'classifyAttachment', 'evaluateCostGate', 'formatCostGate',
    'validateLoopDefinition',
  ];

  const offenders: string[] = [];
  const scan = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { scan(p); continue; }
      if (!entry.name.endsWith('.md')) continue;
      fs.readFileSync(p, 'utf-8').split('\n').forEach((line, i) => {
        if (line.includes('dist/tools/index.js') && GATE_FNS.some((fn) => line.includes(fn))) {
          offenders.push(`${path.relative(ROOT, p)}:${i + 1}`);
        }
      });
    }
  };
  scan(path.join(ROOT, 'skills'));

  it('게이트 호출은 dist/tools/dispatch/index.js 를 쓴다', () => {
    expect(offenders, '통합 배럴은 전 기능의 의존성을 끌어온다 — 게이트는 그러면 안 된다')
      .toEqual([]);
  });
});
