/**
 * validateLoopDefinition 테스트
 *
 * 커버리지:
 * - 유효한 전체 정의 (scheduled + ledger, manual + tests, on-event + none)
 * - 각 enum 위반
 * - schedule iff scheduled 조건
 * - test_command iff tests 조건
 * - max_iterations 범위 (경계값 포함)
 * - pipeline non-vibe 항목
 * - 필수 필드 누락
 */

import { describe, it, expect } from 'vitest';
import { validateLoopDefinition } from './validateLoopDefinition.js';

// ─── Fixture helpers ──────────────────────────────────────────────────

function makeContent(overrides: Record<string, string | string[] | number | undefined> = {}): string {
  const defaults: Record<string, string | string[] | number | undefined> = {
    name: 'nightly-triage',
    trigger: 'scheduled',
    schedule: '0 2 * * *',
    goal: '회귀 항목 자동 처리',
    discover: '오픈 회귀 스캔',
    verify: 'ledger',
    max_iterations: 10,
    isolation: 'none',
    status: 'active',
  };
  const merged = { ...defaults, ...overrides };

  const pipeline = merged['pipeline'] ?? ['vibe.spec', 'vibe.run', 'vibe.verify'];
  delete merged['pipeline'];

  let fm = '---\n';
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined) continue;
    fm += `${k}: ${v}\n`;
  }
  // pipeline 블록 시퀀스
  if (Array.isArray(pipeline) && pipeline.length > 0) {
    fm += 'pipeline:\n';
    for (const item of pipeline as string[]) {
      fm += `  - ${item}\n`;
    }
  }
  fm += '---\n\n# 루프 본문\n';
  return fm;
}

// ─── 유효한 정의 ──────────────────────────────────────────────────────

describe('validateLoopDefinition: 유효한 정의', () => {
  it('scheduled + ledger 전체 정의 → valid=true, errors=[]', () => {
    const result = validateLoopDefinition(makeContent());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.definition).not.toBeNull();
    expect(result.definition?.name).toBe('nightly-triage');
    expect(result.definition?.trigger).toBe('scheduled');
    expect(result.definition?.schedule).toBe('0 2 * * *');
    expect(result.definition?.pipeline).toEqual(['vibe.spec', 'vibe.run', 'vibe.verify']);
    expect(result.definition?.max_iterations).toBe(10);
  });

  it('manual + tests + test_command → valid=true', () => {
    const content = makeContent({
      trigger: 'manual',
      schedule: undefined,
      verify: 'tests',
      test_command: 'npx vitest run',
    });
    const result = validateLoopDefinition(content);
    expect(result.valid).toBe(true);
    expect(result.definition?.trigger).toBe('manual');
    expect(result.definition?.test_command).toBe('npx vitest run');
  });

  it('on-event + none + isolation=worktree → valid=true', () => {
    const content = makeContent({
      trigger: 'on-event',
      schedule: undefined,
      verify: 'none',
      isolation: 'worktree',
    });
    const result = validateLoopDefinition(content);
    expect(result.valid).toBe(true);
    expect(result.definition?.isolation).toBe('worktree');
  });

  it('max_iterations 경계값 1 → valid=true', () => {
    const result = validateLoopDefinition(makeContent({ max_iterations: 1 }));
    expect(result.valid).toBe(true);
  });

  it('max_iterations 경계값 50 → valid=true', () => {
    const result = validateLoopDefinition(makeContent({ max_iterations: 50 }));
    expect(result.valid).toBe(true);
  });
});

// ─── enum 위반 ────────────────────────────────────────────────────────

describe('validateLoopDefinition: enum 위반', () => {
  it('trigger 유효하지 않은 값 → error 포함', () => {
    const result = validateLoopDefinition(makeContent({ trigger: 'daily', schedule: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('trigger'))).toBe(true);
  });

  it('verify 유효하지 않은 값 → error 포함', () => {
    const result = validateLoopDefinition(makeContent({ verify: 'manual-check' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('verify'))).toBe(true);
  });

  it('isolation 유효하지 않은 값 → error 포함', () => {
    const result = validateLoopDefinition(makeContent({ isolation: 'docker' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('isolation'))).toBe(true);
  });

  it('status 유효하지 않은 값 → error 포함', () => {
    const result = validateLoopDefinition(makeContent({ status: 'running' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('status'))).toBe(true);
  });
});

// ─── schedule iff scheduled ───────────────────────────────────────────

describe('validateLoopDefinition: schedule 조건', () => {
  it('trigger=scheduled 인데 schedule 없으면 → error', () => {
    const result = validateLoopDefinition(makeContent({ trigger: 'scheduled', schedule: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('schedule'))).toBe(true);
  });

  it('trigger=scheduled + 잘못된 cron 형식 → error', () => {
    const result = validateLoopDefinition(makeContent({ schedule: 'every day' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('cron'))).toBe(true);
  });

  it('trigger=manual 인데 schedule 있으면 → error', () => {
    const content = makeContent({ trigger: 'manual', schedule: '0 2 * * *' });
    const result = validateLoopDefinition(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('schedule'))).toBe(true);
  });

  it('trigger=on-event 인데 schedule 있으면 → error', () => {
    const content = makeContent({ trigger: 'on-event', schedule: '0 2 * * *' });
    const result = validateLoopDefinition(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('schedule'))).toBe(true);
  });
});

// ─── test_command iff tests ───────────────────────────────────────────

describe('validateLoopDefinition: test_command 조건', () => {
  it('verify=tests 인데 test_command 없으면 → error', () => {
    const content = makeContent({
      trigger: 'manual',
      schedule: undefined,
      verify: 'tests',
    });
    const result = validateLoopDefinition(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('test_command'))).toBe(true);
  });

  it('verify=ledger 인데 test_command 있으면 → error', () => {
    const content = makeContent({ test_command: 'npm test' });
    const result = validateLoopDefinition(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('test_command'))).toBe(true);
  });

  it('verify=none 인데 test_command 있으면 → error', () => {
    const content = makeContent({
      trigger: 'manual',
      schedule: undefined,
      verify: 'none',
      test_command: 'npm test',
    });
    const result = validateLoopDefinition(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('test_command'))).toBe(true);
  });
});

// ─── max_iterations 범위 ──────────────────────────────────────────────

describe('validateLoopDefinition: max_iterations 범위', () => {
  it('max_iterations=0 → error', () => {
    const result = validateLoopDefinition(makeContent({ max_iterations: 0 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('max_iterations'))).toBe(true);
  });

  it('max_iterations=51 → error', () => {
    const result = validateLoopDefinition(makeContent({ max_iterations: 51 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('max_iterations'))).toBe(true);
  });

  it('max_iterations 누락 → error', () => {
    const content = makeContent({ max_iterations: undefined });
    const result = validateLoopDefinition(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('max_iterations'))).toBe(true);
  });
});

// ─── pipeline non-vibe 항목 ───────────────────────────────────────────

describe('validateLoopDefinition: pipeline 항목 검사', () => {
  it('pipeline에 non-vibe 항목 포함 → error', () => {
    const content = makeContent({ pipeline: ['vibe.spec', 'npm-test', 'vibe.verify'] });
    const result = validateLoopDefinition(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('npm-test'))).toBe(true);
  });

  it('pipeline 비어 있음 → error', () => {
    const content = makeContent({ pipeline: [] });
    const result = validateLoopDefinition(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('pipeline'))).toBe(true);
  });

  it('pipeline 모두 vibe. 접두사 → valid=true', () => {
    const content = makeContent({ pipeline: ['vibe.analyze', 'vibe.run', 'vibe.verify'] });
    const result = validateLoopDefinition(content);
    expect(result.valid).toBe(true);
  });
});

// ─── 필수 필드 누락 ───────────────────────────────────────────────────

describe('validateLoopDefinition: 필수 필드 누락', () => {
  it('name 누락 → error', () => {
    const content = makeContent({ name: undefined });
    const result = validateLoopDefinition(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('goal 누락 → error', () => {
    const content = makeContent({ goal: undefined });
    const result = validateLoopDefinition(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('goal'))).toBe(true);
  });

  it('frontmatter 없는 문서 → error 다수', () => {
    const result = validateLoopDefinition('# 루프 본문만 있는 파일\n\n내용\n');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
