/**
 * `verify: visual` — 렌더 결과를 완료 기준으로 삼는 모드.
 *
 * 코드가 도는 것과 화면이 맞는 것은 다르다. `tests` 만으로 도는 UI 루프는
 * **초록불을 켜면서 화면을 망가뜨릴 수 있다.**
 *
 * 다만 이 모드가 "모델이 스크린샷을 보고 판정한다" 는 뜻이 되면 안 된다 — 그건
 * 자기보고이고 loop-contract 가 처음부터 배제하는 것이다. 그래서 구조를 이렇게 갈랐다:
 *
 *   visual_command  게이트 — exit 0 만 성공 (임계값으로 떨어지는 검사)
 *   artifact_dir    증거   — 나중에 사람이 볼 스크린샷·diff
 *
 * `artifact_dir` 이 필수인 이유가 핵심이다: 증거가 없으면 `tests` 와 기능적으로
 * 같아진다. 이 모드가 존재할 이유가 증거이므로, 없으면 정의를 거부한다.
 */
import { describe, it, expect } from 'vitest';
import { validateLoopDefinition } from './validateLoopDefinition.js';

const def = (over: Record<string, string> = {}): string => {
  const fields: Record<string, string> = {
    name: 'ui-loop',
    trigger: 'manual',
    goal: '"UI 회귀를 잡는다"',
    discover: '"변경된 화면을 찾는다"',
    verify: 'visual',
    max_iterations: '5',
    isolation: 'none',
    status: 'active',
    ...over,
  };
  const body = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `---\n${body}\npipeline:\n  - vibe.run\n---\n\n# 루프\n`;
};

const OK = { visual_command: 'npm run test:visual', artifact_dir: '.vibe/e2e/shots' };

describe('verify: visual', () => {
  it('명령과 증거 위치가 모두 있으면 통과한다', () => {
    const r = validateLoopDefinition(def(OK));
    expect(r.errors).toEqual([]);
    expect(r.definition?.verify).toBe('visual');
    expect(r.definition?.visual_command).toBe('npm run test:visual');
    expect(r.definition?.artifact_dir).toBe('.vibe/e2e/shots');
  });

  /**
   * 따옴표째 저장하면 실행 시 깨진다 — `sh -c '"npm run vr"'` 는 `npm run vr` 라는
   * 이름의 파일을 찾는다. 이 테스트의 초안은 그 버그를 "관례" 로 굳혀놓고 있었다.
   */
  it('감싼 따옴표를 벗긴다 — 따옴표째면 셸이 파일 이름으로 읽는다', () => {
    const r = validateLoopDefinition(def({ ...OK, visual_command: '"npm run vr"' }));
    expect(r.definition?.visual_command).toBe('npm run vr');
  });

  it('게이트 명령이 없으면 거부한다 — 판정 수단이 없다', () => {
    const r = validateLoopDefinition(def({ artifact_dir: 'x' }));
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toContain('visual_command');
  });

  /** 이 모드가 존재할 이유가 증거다 — 없으면 tests 와 같아진다 */
  it('증거 위치가 없으면 거부한다', () => {
    const r = validateLoopDefinition(def({ visual_command: 'npm run vr' }));
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toContain('artifact_dir');
  });

  it.each(['ledger', 'tests', 'none'])('verify=%s 에서는 시각 필드를 허용하지 않는다', (mode) => {
    const extra = mode === 'tests' ? { test_command: 'npm test' } : {};
    const r = validateLoopDefinition(def({ verify: mode, ...extra, ...OK }));
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/visual_command|artifact_dir/);
  });

  it('기존 모드는 그대로 동작한다 — 축을 늘리되 기존을 건드리지 않는다', () => {
    expect(validateLoopDefinition(def({ verify: 'ledger' })).valid).toBe(true);
    expect(validateLoopDefinition(def({ verify: 'tests', test_command: 'npm test' })).valid).toBe(true);
  });
});

/**
 * 문서가 이 구분을 잃으면 구현만 남고 이유가 사라진다 — 그러면 다음 사람이
 * "모델이 보고 판단하게 하자" 로 되돌린다.
 */
describe('시각 검증의 경계가 문서에 남아 있다', () => {
  it('loop-contract 가 자기보고를 배제한다고 명시한다', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const text = fs.readFileSync(
      path.resolve(__dirname, '..', '..', '..', 'vibe', 'rules', 'loop-contract.md'), 'utf-8');
    expect(text).toContain('verify: visual');
    expect(text, '판정은 exit code 라는 점이 남아 있어야 한다').toMatch(/exit code/);
    expect(text, '모델이 보고 판정하는 것이 아니라는 경고').toMatch(/자기보고/);
  });
});
