import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  REVERSE_DRIFT_KINDS,
  isReverseDriftKind,
  classifyReverseDrift,
  summarizeReverseDrift,
  formatReverseReport,
  formatReverseInboxLines,
} from './reverseDrift.js';
import type { ReverseDriftFinding } from './reverseDrift.js';

/**
 * SPEC: .vibe/specs/reverse-contract-drift.md (DC-1 ~ DC-7).
 *
 * 고정하는 것은 **불변식**이다 — 어느 종류가 P2 인지는 선택이므로 박지 않고,
 * 등급·목적지가 필요하다는 사실과 "차단하지 않는다" 는 정책만 고정한다
 * (CLAUDE.md "테스트는 불변식을 고정하고, 선택은 고정하지 않는다").
 */

const ROOT = path.resolve(__dirname, '..', '..', '..');

const SAMPLE: ReverseDriftFinding[] = [
  { kind: 'unspecified-endpoint', surface: 'GET /users/:id/avatar', location: 'src/routes/users.ts:42' },
  { kind: 'unspecified-field', surface: 'get-user.response.200.phoneNumber' },
  { kind: 'unspecified-field', surface: 'get-user.response.200.locale', note: '기본값 en' },
];

describe('DC-1 — 종류와 분류', () => {
  it('모든 종류가 등급과 이유를 갖는다', () => {
    for (const kind of REVERSE_DRIFT_KINDS) {
      const c = classifyReverseDrift(kind);
      expect(c.severity, kind).toBeTruthy();
      expect(c.reason.length, kind).toBeGreaterThan(0);
    }
  });

  it('종류 목록에 중복이 없다', () => {
    expect(new Set(REVERSE_DRIFT_KINDS).size).toBe(REVERSE_DRIFT_KINDS.length);
  });

  it('알 수 없는 종류는 조용히 통과시키지 않는다', () => {
    expect(isReverseDriftKind('unspecified-galaxy')).toBe(false);
    // @ts-expect-error — 런타임 호출자(node -e)가 넘길 수 있는 잘못된 값
    expect(() => classifyReverseDrift('unspecified-galaxy')).toThrow();
  });
});

describe('DC-2 — 정책: 역방향 판정은 루프를 차단하지 않는다', () => {
  // 정책 단언이므로 값을 박는다. 뒤집으려면 이 테스트를 의도적으로 지워야 한다
  // (loop-contract "Judge 권한 경계" — 판정된 P1 은 단독 차단 근거가 아니다).
  it.each([...REVERSE_DRIFT_KINDS])('%s 는 비차단이고 목적지가 인박스다', (kind) => {
    const c = classifyReverseDrift(kind);
    expect(c.blocking).toBe(false);
    expect(c.destination).toBe('inbox');
  });

  it('어떤 종류도 P1 을 내지 않는다', () => {
    for (const kind of REVERSE_DRIFT_KINDS) {
      expect(classifyReverseDrift(kind).severity).not.toBe('P1');
    }
  });

  it('게이트로 보내는 목적지가 존재하지 않는다', () => {
    const destinations = new Set(REVERSE_DRIFT_KINDS.map((k) => classifyReverseDrift(k).destination));
    expect([...destinations]).toEqual(['inbox']);
  });
});

describe('summarizeReverseDrift', () => {
  it('종류별·등급별 합계가 총계와 일치한다', () => {
    const s = summarizeReverseDrift(SAMPLE);
    const byKindTotal = REVERSE_DRIFT_KINDS.reduce((sum, k) => sum + s.byKind[k], 0);
    expect(s.total).toBe(SAMPLE.length);
    expect(byKindTotal).toBe(s.total);
    expect(s.bySeverity.P2 + s.bySeverity.P3).toBe(s.total);
  });

  it('빈 입력에서 모든 칸이 0이다', () => {
    const s = summarizeReverseDrift([]);
    expect(s.total).toBe(0);
    expect(REVERSE_DRIFT_KINDS.every((k) => s.byKind[k] === 0)).toBe(true);
  });
});

describe('DC-3 — 리포트 포맷', () => {
  const report = formatReverseReport({
    feature: 'users',
    specPath: '.vibe/specs/users.md',
    comparedAt: '2026-09-02T00:00:00.000Z',
    findings: SAMPLE,
  });

  it('frontmatter 에 대조 기준과 비차단 사실이 들어간다', () => {
    expect(report.startsWith('---\n')).toBe(true);
    expect(report).toContain('feature: users');
    expect(report).toContain('spec: .vibe/specs/users.md');
    expect(report).toContain('compared-at: 2026-09-02T00:00:00.000Z');
    expect(report).toContain('direction: implementation-to-spec');
    expect(report).toContain('blocking: false');
  });

  it('종류별 개수를 frontmatter 에 남긴다', () => {
    for (const kind of REVERSE_DRIFT_KINDS) {
      expect(report).toContain(`  ${kind}: `);
    }
  });

  it('발견이 있는 종류만 섹션으로 나온다', () => {
    expect(report).toContain('unspecified-endpoint (1)');
    expect(report).toContain('unspecified-field (2)');
    expect(report).not.toContain('unspecified-status-code (');
  });

  it('위치와 부연은 있을 때만 붙는다', () => {
    expect(report).toContain('`GET /users/:id/avatar` — src/routes/users.ts:42');
    expect(report).toContain('`get-user.response.200.phoneNumber`');
    expect(report).not.toContain('phoneNumber` —');
    expect(report).toContain('(기본값 en)');
  });

  it('발견 0건이어도 대조했다는 증거를 남긴다', () => {
    const clean = formatReverseReport({
      feature: 'users',
      specPath: '.vibe/specs/users.md',
      comparedAt: '2026-09-02T00:00:00.000Z',
      findings: [],
    });
    expect(clean).toContain('total: 0');
    expect(clean).toContain('결손 없음');
  });
});

describe('DC-4 — 인박스 줄', () => {
  it('발견 0건이면 빈 배열 — 빈 블록을 인박스에 남기지 않는다', () => {
    expect(formatReverseInboxLines('users', [])).toEqual([]);
  });

  it('머리줄에 총계와 비차단 사실, 근거 파일 경로가 있다', () => {
    const lines = formatReverseInboxLines('users', SAMPLE);
    expect(lines[0]).toContain('3건');
    expect(lines[0]).toContain('차단 아님');
    expect(lines[1]).toBe('근거: .vibe/contracts/users.reverse.md');
    expect(lines).toHaveLength(2 + SAMPLE.length);
  });

  it('각 항목이 등급과 표면을 담는다', () => {
    const lines = formatReverseInboxLines('users', SAMPLE);
    expect(lines[2]).toContain('unspecified-endpoint: GET /users/:id/avatar');
    expect(lines[2]).toContain('@ src/routes/users.ts:42');
  });
});

describe('DC-6 · DC-7 — vibe.contract 스킬 본문 계약', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'skills/vibe.contract/SKILL.md'), 'utf-8');

  it('reverse 서브커맨드가 Usage 와 본문에 존재한다', () => {
    expect(doc).toMatch(/\/vibe\.contract reverse/);
    expect(doc).toMatch(/###\s*4\.\s*`reverse`/);
  });

  it('역방향이 차단하지 않는다는 사실이 본문에 명시된다', () => {
    expect(doc).toMatch(/차단하지 않는다|does not block/);
    expect(doc).toContain('.vibe/contracts/<feature>.reverse.md');
  });

  it('기존 정방향 P1 강등 경로가 회귀하지 않는다', () => {
    expect(doc).toContain('P1 drift → demote verify to fail; auto-register');
  });

  it('역방향에는 P1 등급이 없다고 본문이 말한다', () => {
    const section = doc.slice(doc.indexOf('### 4. `reverse`'));
    expect(section).toMatch(/P1 을 만들지 않는다|P1 은 없다/);
  });
});
