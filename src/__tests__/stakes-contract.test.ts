import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Stakes-proportional pipeline — 정적 계약 테스트 (SPEC: stakes-proportional-pipeline).
 *
 * 스킬 본문 규칙은 모델이 읽는 계약이므로, 규칙이 각 파일에 존재·유지되는지를
 * 순수 fs 검사로 고정한다 (wiring-integrity 선례). D1–D5 게이트.
 */

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

describe('D2 — loop-contract.md: Stakes 매핑 SSOT', () => {
  const doc = read('vibe/rules/loop-contract.md');

  it('stakes 파라미터가 기본값 production 으로 정의된다', () => {
    expect(doc).toMatch(/\|\s*`stakes`\s*\|\s*`production`\s*\|/);
  });

  it('Stakes 매핑 표에 demo/prototype/production 3단계가 있다', () => {
    for (const level of ['`demo`', '`prototype`', '`production`']) {
      expect(doc, `Stakes 표에 ${level} 행 누락`).toContain(level);
    }
  });

  it('demo/prototype 는 max_iterations 1 + 검증 스크립트 신규 생성 금지', () => {
    expect(doc).toContain('신규 생성 금지');
    expect(doc).toMatch(/`demo`[^\n]*\|\s*1\s*\|/);
  });

  it('불확실 시 상향(production) 원칙이 명시된다', () => {
    expect(doc).toMatch(/불확실하면 항상 상향|불확실하면 상향/);
  });

  it('JUDGE 검증 산출물 절제: git diff --numstat 기반 P2 경고 (advisory)', () => {
    expect(doc).toContain('JUDGE 검증 산출물 절제');
    expect(doc).toContain('git diff --numstat');
    expect(doc).toContain('P2');
    expect(doc).toMatch(/게이트 통과 여부를 바꾸지 않는다/);
  });

  it('production 기본 동작 불변: max_iterations 기본 10 유지', () => {
    expect(doc).toMatch(/\|\s*`max_iterations`\s*\|\s*10\s*\|/);
  });
});

describe('D1 — vibe 디스패처: stakes 분류 규칙', () => {
  const doc = read('skills/vibe/SKILL.md');

  it('Phase 1-b Stakes 분류 섹션이 존재한다', () => {
    expect(doc).toContain('Phase 1-b: Stakes 분류');
  });

  it('경량 프로파일 매핑(--max-iter 1, 리뷰 1패스, 검증 스크립트 신규 생성 금지)이 명시된다', () => {
    expect(doc).toContain('--max-iter 1');
    expect(doc).toContain('리뷰 1패스');
    expect(doc).toContain('검증 스크립트 신규 생성 금지');
  });

  it('SSOT 로 loop-contract.md 를 참조한다', () => {
    expect(doc).toMatch(/loop-contract\.md[^\n]*Stakes|Stakes[^\n]*loop-contract\.md/);
  });

  it('불확실 시 상향 + SPEC 승인 편승 질문이 명시된다', () => {
    expect(doc).toContain('불확실하면 상향');
    expect(doc).toMatch(/SPEC 승인 메시지에 stakes 확인 질문/);
  });
});

describe('D3 — vibe.spec: 승인 게이트 stakes 편승 질문', () => {
  const doc = read('skills/vibe.spec/SKILL.md');

  it('Stakes 편승 질문 규칙이 승인 섹션에 존재한다', () => {
    expect(doc).toContain('Stakes 편승 질문');
    expect(doc).toMatch(/demo\/prototype\/production/);
  });

  it('별도 추가 왕복 금지가 명시된다', () => {
    expect(doc).toMatch(/추가 확인 왕복을 만들지 않는다/);
  });
});

describe('D4 — vibe.run: stakes 프로파일 + JUDGE 절제 참조', () => {
  const doc = read('skills/vibe.run/SKILL.md');

  it('Stakes 프로파일 섹션이 loop-contract 를 SSOT 로 참조한다', () => {
    expect(doc).toContain('Stakes 프로파일');
    expect(doc).toMatch(/SSOT[^\n]*loop-contract\.md/);
  });

  it('demo/prototype 에서 검증 스크립트 신규 생성 금지가 명시된다', () => {
    expect(doc).toContain('검증 스크립트 신규 생성 금지');
  });

  it('JUDGE 검증 산출물 절제(P2, git diff --numstat, advisory)가 명시된다', () => {
    expect(doc).toContain('git diff --numstat');
    expect(doc).toMatch(/P2 경고/);
    expect(doc).toMatch(/advisory/);
  });
});

describe('D5 — vibe.review: 리뷰어 스케일링', () => {
  const doc = read('skills/vibe.review/SKILL.md');

  it('스케일링 표가 존재한다 (demo ≤5 → 2종)', () => {
    expect(doc).toContain('리뷰어 스케일링');
    expect(doc).toMatch(/demo[^\n]*≤5[^\n]*2종/);
  });

  it('production 행은 기존 Core Reviewers 전체를 유지한다', () => {
    expect(doc).toMatch(/production[^\n]*Core Reviewers 전체/);
    // 기존 기본 셋 불변 검증 — Core Reviewers 표의 focus 들이 그대로 존재
    for (const focus of [
      'security-reviewer',
      'focus: correctness',
      'focus: data-integrity',
      'focus: performance',
      'focus: architecture',
      'focus: complexity',
      'focus: git-history',
      'focus: test-coverage',
    ]) {
      expect(doc, `Core Reviewers 에서 ${focus} 가 사라짐 — production 불변 위반`).toContain(focus);
    }
  });

  it('SSOT 로 loop-contract.md 를 참조한다', () => {
    expect(doc).toMatch(/loop-contract\.md[^\n]*Stakes/);
  });
});
