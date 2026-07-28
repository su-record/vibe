import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { adaptToCodex, buildGlobalSection } from '../cli/setup/ProjectSetup.js';

/**
 * 지침 표면 드리프트 가드 — 감사 2026-07-27.
 *
 * 같은 규칙이 여러 파일에 적혀 있는 것 자체는 결함이 아니다. agent 프롬프트와
 * skill reference 는 임의의 사용자 프로젝트로 배포되므로 자기완결적이어야 하고,
 * 포인터로 바꾸면 dual-harness-doctrine 의 "암묵적 동작에 의존하지 않는다" 를
 * 위반한다. 실제 위험은 **드리프트** — 한 곳만 고치면 나머지가 조용히 낡는다.
 *
 * 실제로 갈라져 있던 것:
 *   constitution.md      "Functions ≤30 lines (recommended), ≤50 (allowed)"  ← CLAUDE.md 는 ≤50
 *   ProjectSetup.ts      전역 Git include 가 repo CLAUDE.md 의 부분집합
 *   ProjectSetup.ts      3+ files 진입점이 `/vibe.spec`, 같은 파일 hard trigger 는 `/vibe`
 */

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/** SSOT: CLAUDE.md "Complexity Limits" */
// 간격에서 `≤` 를 제외한다 — 포함하면 "Nesting ≤3 · Params ≤5" 에서 nesting 이 5 를 집는다
const LIMITS = [
  { name: '함수 길이', re: /functions?\b[^.\n|≤]{0,24}≤\s*(\d+)\s*lines/gi, value: 50 },
  { name: '중첩 깊이', re: /nesting\b[^.\n|≤]{0,24}≤\s*(\d+)/gi, value: 3 },
  { name: '파라미터 수', re: /params?(?:eters)?\b[^.\n|≤]{0,24}≤\s*(\d+)/gi, value: 5 },
  { name: '순환 복잡도', re: /cyclomatic\b[^.\n|≤]{0,24}≤\s*(\d+)/gi, value: 10 },
] as const;

/** 복잡도 한계를 숫자로 다시 적는 문서 — 새로 적는 문서가 생기면 여기 등록한다 */
const DOCS_RESTATING_LIMITS = [
  'CLAUDE.md',
  'AGENTS.md',
  'vibe/constitution.md',
  'vibe/templates/claudemd-template.md',
  'vibe/templates/constitution-template.md',
  'vibe/rules/standards/complexity-metrics.md',
  'vibe/rules/quality/checklist.md',
  'agents/implementer.md',
  'agents/code-reviewer.md',
  'skills/vibe.run/references/race-review.md',
  'skills/vibe.run/references/guidelines-and-tools.md',
  'skills/vibe.capability-loop/agents/implementer.md',
] as const;

describe('복잡도 한계가 모든 재기술 지점에서 같다', () => {
  it.each(DOCS_RESTATING_LIMITS)('%s', (rel) => {
    const doc = read(rel);
    for (const limit of LIMITS) {
      for (const [, n] of doc.matchAll(limit.re)) {
        expect(Number(n), `${rel}: ${limit.name} 한계가 SSOT(CLAUDE.md)와 다르다`).toBe(limit.value);
      }
    }
  });
});

/**
 * 전역 규약(`~/.claude/CLAUDE.md`)은 ProjectSetup.buildGlobalSection 이 생성한다.
 * 설치본은 손댈 수 없으므로 생성기 소스와 repo CLAUDE.md 를 비교한다.
 */
describe('전역 규약 생성기가 repo CLAUDE.md 와 어긋나지 않는다', () => {
  const GENERATOR = 'src/cli/setup/ProjectSetup.ts';

  /** `.vibe/{a,b,c}` 중괄호 안 항목 집합 */
  function vibeIncludeSet(text: string): Set<string> {
    const m = text.match(/Include\*{0,2}:\s*`\.vibe\/\{([^}]+)\}`/);
    if (!m) throw new Error('Include 목록을 찾지 못했다');
    return new Set(m[1].split(',').map(s => s.trim()));
  }

  it('Git include 목록이 같다', () => {
    expect(vibeIncludeSet(read(GENERATOR))).toEqual(vibeIncludeSet(read('CLAUDE.md')));
  });

  it('3+ files 진입점이 hard trigger 와 같은 `/vibe` 를 가리킨다', () => {
    const table = buildGlobalSection('en');
    const row = table.match(/\| 3\+ files \| ([^|]+)\|/);
    expect(row?.[1], '표와 hard trigger 가 다른 진입점을 지시하면 같은 조건에 지시가 둘이 된다')
      .toMatch(/`\/vibe`/);
    expect(table).toContain('run `/vibe` FIRST');
  });
});

/**
 * Codex 전역 규약은 buildGlobalSection 출력을 변환해 만든다. 행별 정확 문자열
 * 치환이던 시절, 생성기 문구를 고치면 변환이 조용히 누락됐다 — 결과물로 검증한다.
 */
describe('Codex 변환이 슬래시 커맨드를 남기지 않는다', () => {
  const codex = adaptToCodex(buildGlobalSection('en'));

  it('vibe 진입점이 모두 `$vibe` 형태다', () => {
    // Codex 안내 문장 자체의 `/vibe.*` 표기(= 존재하지 않는다는 설명)만 예외
    const leftovers = codex
      .split('\n')
      .filter(l => /\/vibe\b/.test(l) && !l.includes('not top-level'));
    expect(leftovers, `변환되지 않은 줄:\n${leftovers.join('\n')}`).toEqual([]);
  });

  it('hard trigger 도 함께 변환된다', () => {
    expect(codex).toContain('run `$vibe` FIRST');
  });

  it('Codex 는 commands/ 를 제외 목록에서 뺀다', () => {
    expect(codex).toContain('`~/.codex/{rules,agents,skills}/`');
  });

  it('`.claude/` 경로가 남지 않는다', () => {
    expect(codex).not.toMatch(/~\/\.claude\//);
  });
});

/**
 * console.log 탐지 범위 규칙은 lib/console-allow.js 하나만 둔다.
 * code-check.js 와 post-edit.js 가 각자 들고 있던 시절, allow-list 없는 쪽이
 * 있는 쪽의 예외 설계를 무력화해 `src/cli/**` 에서도 경고가 남았다.
 */
describe('console.log 허용 경로 규칙이 한 곳에만 있다', () => {
  const HOOKS = ['hooks/scripts/code-check.js', 'hooks/scripts/post-edit.js'] as const;

  it.each(HOOKS)('%s 가 공용 모듈을 쓴다', (rel) => {
    expect(read(rel)).toMatch(/from '\.{1,2}\/lib\/console-allow\.js'/);
  });

  it.each(HOOKS)('%s 가 허용 글로브를 자체 정의하지 않는다', (rel) => {
    expect(read(rel), `${rel}: 허용 경로 목록이 다시 등장`).not.toMatch(/DEFAULT_CONSOLE_ALLOW_GLOBS/);
  });
});
