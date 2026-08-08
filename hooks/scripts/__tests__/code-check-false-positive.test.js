/**
 * code-check 오탐 회귀 테스트
 *
 * 재현했던 결함: `any` 를 금지하는 문서 문장(주석·템플릿 리터럴)이 그 자체로
 * P1 any-type 으로 잡혀, ProjectSetup.ts 를 편집할 때마다 고칠 수 없는 경고가
 * additionalContext 에 주입됐다. 이스케이프된 백틱(\`)이 템플릿 리터럴을
 * 조기 종료시킨 것이 직접 원인.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { run } from '../code-check.js';

let dir;

const write = (name, content) => {
  const p = path.join(dir, name);
  writeFileSync(p, content, 'utf-8');
  return p;
};

const findingsFor = async (filePath) => (await run({ filePath })).findings;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'code-check-fp-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('code-check: any 탐지는 코드 구간에만 적용된다', () => {
  it('줄 주석 안의 as any 는 P1 이 아니다', async () => {
    const f = write('line-comment.ts', '// as any 를 쓰지 말 것\nexport const a = 1;\n');
    expect(await findingsFor(f)).toEqual([]);
  });

  it('블록 주석 안의 : any 는 P1 이 아니다', async () => {
    const f = write('block-comment.ts', '/**\n * 금지: : any\n */\nexport const b = 2;\n');
    expect(await findingsFor(f)).toEqual([]);
  });

  it('여러 줄 템플릿 리터럴 안의 any 는 P1 이 아니다', async () => {
    const f = write('template.ts', 'export const DOC = `\n금지 패턴: any / as any / @ts-ignore\n`;\n');
    expect(await findingsFor(f)).toEqual([]);
  });

  it('이스케이프된 백틱이 템플릿 리터럴을 조기 종료시키지 않는다', async () => {
    // 직접 원인 회귀: \` 를 종료 백틱으로 오인하면 다음 줄부터 코드로 오판한다
    const f = write('escaped-backtick.ts', [
      'export const RULES = `',
      '- 금지: \\`any\\`/\\`as any\\`/\\`@ts-ignore\\`',
      '- 금지: \\`console.log\\`',
      '`;',
      '',
    ].join('\n'));
    expect(await findingsFor(f)).toEqual([]);
  });

  it('실제 코드의 any 는 여전히 P1 으로 잡힌다', async () => {
    const f = write('real.ts', 'export function real(x: any): void { void x; }\n');
    const findings = await findingsFor(f);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('P1 any-type');
  });

  it('주석과 실제 코드가 섞이면 실제 코드만 잡는다', async () => {
    const f = write('mixed.ts', '// as any 금지\nexport function g(y: any): void { void y; }\n');
    const findings = await findingsFor(f);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('line 2');
  });
});

/**
 * 미탐 회귀 (2026-08-08).
 *
 * 오탐만 고치고 미탐은 남겨두면 게이트 신뢰도는 반쪽이다. 상태 모델이 단순해
 * 두 가지를 놓치고 있었다:
 *  - 템플릿 보간 `${...}` 안은 **실행되는 코드**인데 문자열로 취급해 건너뛰었다
 *  - 정규식 리터럴 안의 백틱을 템플릿 시작으로 오인해 이후 줄이 통째로 무력화됐다
 */
describe('code-check: 코드인 구간을 놓치지 않는다', () => {
  it('템플릿 보간 안의 as any 를 잡는다', async () => {
    const f = write('interp.ts', 'const t = `a ${(v as any)} b`;\n');
    const findings = await findingsFor(f);
    expect(findings.some(x => x.includes('any-type'))).toBe(true);
  });

  it('중첩 템플릿 보간도 잡는다', async () => {
    const f = write('nested.ts', 'const t = `x ${`y ${(v as any)}`} z`;\n');
    expect((await findingsFor(f)).some(x => x.includes('any-type'))).toBe(true);
  });

  it('보간 안의 console.log 도 잡는다', async () => {
    const f = write('interp-log.ts', 'const t = `${console.log(1)}`;\n');
    expect((await findingsFor(f)).some(x => x.includes('console.log'))).toBe(true);
  });

  it('정규식 리터럴의 백틱이 이후 코드를 무력화하지 않는다', async () => {
    const f = write('regex-tick.ts', 'const re = /`/;\nexport function d(x: any): void { void x; }\n');
    expect((await findingsFor(f)).some(x => x.includes('any-type'))).toBe(true);
  });

  it('정규식 리터럴의 따옴표도 마찬가지', async () => {
    const f = write('regex-quote.ts', "const re = /'/;\nexport function d(x: any): void { void x; }\n");
    expect((await findingsFor(f)).some(x => x.includes('any-type'))).toBe(true);
  });

  it('나눗셈을 정규식으로 오인하지 않는다', async () => {
    // a / b / c 를 정규식으로 읽으면 그 사이 코드가 통째로 사라진다
    const f = write('division.ts', 'const r = a / b / c;\nexport function d(x: any): void { void x; }\n');
    expect((await findingsFor(f)).some(x => x.includes('any-type'))).toBe(true);
  });

  it('보간 안 객체 리터럴이 보간을 조기 종료시키지 않는다', async () => {
    // `${ {a:1}.x as any }` — 첫 `}` 는 객체를 닫는 것이지 보간의 끝이 아니다
    const f = write('brace-depth.ts', 'const t = `${ {a:1}.x as any }`;\n');
    expect((await findingsFor(f)).some(x => x.includes('any-type'))).toBe(true);
  });

  it('보간 안 중괄호가 다음 줄로 새지 않는다', async () => {
    const f = write('brace-leak.ts',
      'const t = `${ f({a:1}) } tail`;\nexport function g(x: any): void { void x; }\n');
    expect((await findingsFor(f)).some(x => x.includes('line 2'))).toBe(true);
  });

  it('템플릿 리터럴 본문은 여전히 문자열로 본다', async () => {
    const f = write('body.ts', 'export const DOC = `\n금지: as any\n`;\n');
    expect(await findingsFor(f)).toEqual([]);
  });
});
