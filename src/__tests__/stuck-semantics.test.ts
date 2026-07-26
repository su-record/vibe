import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * `stuck` 시맨틱 계약 — 4개 문서가 서로 모순됐던 회귀를 막는다.
 *
 * 발견 경위: Codex 하네스에 SKILL.md 를 읽혀 검증하던 중, 같은 규칙이 문서마다
 * 다르게 적혀 있는 것이 드러났다.
 *
 *   loop-contract.md:24  stuck = EXIT 조건
 *   loop-contract.md:44  autonomous = "기록 후 계속"      ← 같은 파일 안에서 상충
 *   CLAUDE.md            autonomous "continues"
 *   vibe/SKILL.md        autonomous → "루프 종료"          ← 정반대
 *
 * 확정된 시맨틱: **stuck 은 어느 automationLevel 에서도 루프를 종료한다.**
 * 2회 연속 동일 발견은 정의상 재시도가 무의미하므로 루프 연장은 성립하지 않는다.
 * automationLevel 이 결정하는 것은 "사람에게 묻는지" 와 "다음 단위로 넘어가는지" 뿐이며,
 * 미달은 절대 완료로 기록하지 않는다.
 */

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/** stuck 규칙을 진술하는 모든 문서 — 새 문서를 추가하면 여기에 등록한다 */
const DOCS_STATING_STUCK = [
  'vibe/rules/loop-contract.md',
  'CLAUDE.md',
  'AGENTS.md',
  'skills/vibe/SKILL.md',
  'skills/vibe.run/references/automation-level.md',
  'skills/vibe.run/references/coverage-loop.md',
] as const;

describe('stuck 시맨틱 — SSOT', () => {
  const ssot = read('vibe/rules/loop-contract.md');

  it('stuck 이 루프를 종료한다고 명시한다', () => {
    expect(ssot).toMatch(/그 루프는 종료한다/);
  });

  it('autonomous 의 "계속" 이 루프 연장이 아님을 명시한다', () => {
    expect(ssot).toMatch(/stuck 난 루프를 더 돌린다는 뜻이 아니다/);
  });

  it('미달을 완료로 기록하지 않는다는 규칙이 있다', () => {
    expect(ssot).toMatch(/완료로 기록하지 않는다/);
  });

  it('confirm/autonomous 모두 루프는 종료임을 표로 구분한다', () => {
    // 질문 여부와 루프 종료를 섞지 말라는 지시가 있어야 한다
    expect(ssot).toMatch(/이 둘을 섞지 말/);
  });
});

describe('stuck 시맨틱 — 문서 간 정합', () => {
  it.each(DOCS_STATING_STUCK)('%s 가 stuck 을 "계속 재시도" 로 기술하지 않는다', (rel) => {
    const doc = read(rel);

    // stuck 을 언급하지 않는 문서는 검사 대상이 아니다
    if (!/stuck/i.test(doc)) return;

    // "stuck → 계속" 류의 단정을 금지한다. 부정문("계속한다는 뜻이 아니다",
    // "keep retrying" 를 부정하는 문장)은 허용해야 하므로, 금지 패턴은
    // stuck 직후에 곧바로 연장을 지시하는 형태로 좁힌다.
    expect(doc, `${rel}: stuck 을 루프 연장으로 기술함`)
      .not.toMatch(/stuck[^\n.]{0,40}(?:이면|→|->)\s*(?:루프를? )?계속(?!한다는 뜻이 아니)/);
  });

  it.each(DOCS_STATING_STUCK)('%s 가 sub-100/미달을 완료로 기록하지 않는다고 유지한다', (rel) => {
    const doc = read(rel);
    if (!/stuck/i.test(doc)) return;

    // 각 문서는 미달 처리를 어떤 형태로든 명시해야 한다 (완료 금지 / TODO / 인박스)
    expect(doc, `${rel}: 미달 처리 규칙 없음`)
      .toMatch(/완료로 기록하지 않는다|as complete|TODO|인박스/);
  });
});
