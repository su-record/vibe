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
