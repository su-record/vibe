/**
 * frontmatter 스칼라의 따옴표 처리.
 *
 * 파서가 `out[key] = raw` 로 원문을 그대로 담고 있었다. YAML 에서 `key: "value"` 는
 * 문자열 `value` 를 뜻하는데, 따옴표째 저장되면 그 값을 쓰는 쪽에서 깨진다.
 * 그리고 **vibe 가 배송하는 템플릿이 따옴표를 쓰라고 가르친다:**
 *
 *   schedule: "0 2 * * *"     → `"0 2 * * *"` 가 crontab 에 들어가 cron 필드 5개를 깬다
 *   test_command: "npm test"  → sh 가 `npm test` 라는 이름의 파일을 찾는다 (not found)
 *
 * 즉 기본 경로를 그대로 따라가면 깨지는 상태였다. 실측:
 *
 *   $ sh -c '"npm test"'
 *   sh: 1: npm test: not found
 *
 * 짝이 맞는 감싼 따옴표만 벗긴다 — 값 안의 따옴표나 짝이 안 맞는 것은 사용자가
 * 의도한 리터럴일 수 있으므로 건드리지 않는다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { validateLoopDefinition } from './validateLoopDefinition.js';

const def = (over: Record<string, string> = {}): string => {
  const fields: Record<string, string> = {
    name: 'demo',
    trigger: 'manual',
    goal: 'g',
    discover: 'd',
    verify: 'ledger',
    max_iterations: '5',
    isolation: 'none',
    status: 'active',
    ...over,
  };
  const body = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `---\n${body}\npipeline:\n  - vibe.run\n---\n\n# 루프\n`;
};

const parsed = (over: Record<string, string>): Record<string, unknown> =>
  validateLoopDefinition(def(over)).definition as unknown as Record<string, unknown>;

describe('감싼 따옴표를 벗긴다', () => {
  it.each([
    ['큰따옴표', '"npm test"', 'npm test'],
    ['작은따옴표', "'npm test'", 'npm test'],
    ['따옴표 없음', 'npm test', 'npm test'],
  ])('%s', (_label, input, want) => {
    expect(parsed({ verify: 'tests', test_command: input }).test_command).toBe(want);
  });

  /** crontab 으로 그대로 들어가는 값이라 가장 위험했다 */
  it('schedule 의 따옴표를 벗긴다 — crontab 에 들어가면 필드가 깨진다', () => {
    const d = parsed({ trigger: 'scheduled', schedule: '"0 2 * * *"' });
    expect(d.schedule).toBe('0 2 * * *');
  });

  it('goal·discover 같은 산문 필드에도 적용된다', () => {
    const d = parsed({ goal: '"한 문장 목표"' });
    expect(d.goal).toBe('한 문장 목표');
  });
});

describe('건드리지 않는 것', () => {
  it('값 안의 따옴표는 남긴다', () => {
    const d = parsed({ verify: 'tests', test_command: 'sh -c "npm test"' });
    expect(d.test_command).toBe('sh -c "npm test"');
  });

  it('짝이 맞지 않으면 남긴다 — 사용자가 의도한 리터럴일 수 있다', () => {
    expect(parsed({ goal: '"열린 따옴표' }).goal).toBe('"열린 따옴표');
  });

  it('따옴표 한 글자는 그대로 둔다', () => {
    expect(parsed({ goal: '"' }).goal).toBe('"');
  });
});

/**
 * 템플릿이 기본 경로다 — 여기서 깨지면 처음 쓰는 사람이 그대로 밟는다.
 */
describe('배송 템플릿이 그대로 동작한다', () => {
  const template = fs
    .readFileSync(path.resolve(__dirname, '..', '..', '..', 'vibe', 'templates', 'loop-template.md'), 'utf-8')
    .replace(/\{loop-name\}/g, 'demo')
    .replace(/\{[^}]*\}/g, 'placeholder');

  const d = validateLoopDefinition(template).definition;

  it('검증을 통과한다', () => {
    expect(d).not.toBeNull();
  });

  it('schedule 이 cron 표현식 그대로다 — 따옴표가 섞이지 않는다', () => {
    expect(d?.schedule).toBe('0 2 * * *');
    expect(d?.schedule).not.toContain('"');
  });
});
