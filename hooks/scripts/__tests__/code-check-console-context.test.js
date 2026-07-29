/**
 * code-check console.log 탐지의 코드 구간 게이트 (REQ-audit-p2-remediation-006)
 *
 * 배경: detectConsoleLogs 가 원본 라인을 그대로 정규식 검사해, 코드 파일 안의
 * JSDoc 예시와 사용자에게 출력할 마크다운 템플릿 리터럴까지 P1 으로 주입했다.
 * 같은 파일의 detectAnyType 은 stripNonCodeLine 을 적용하면서 그 이유를 독스트링에
 * 적어두고 detectConsoleLogs 를 참조하는데, 정작 적용이 빠져 있었다.
 * 2026-07-28 감사 실측: 지적된 9건 중 7건이 이 오탐.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DISPATCHER = path.resolve(__dirname, '..', 'post-edit-dispatcher.js');

let projectDir;

beforeEach(() => {
  // src/ 하위 코드 파일이어야 기본 허용 경로(**/cli/** 등)에 걸리지 않는다
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-console-'));
  fs.mkdirSync(path.join(projectDir, 'src', 'lib'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(projectDir, { recursive: true, force: true });
});

/** 파일을 쓰고 code-check 를 돌려 console 관련 P1 줄 번호를 돌려준다 */
function consoleFindings(relPath, content) {
  const abs = path.join(projectDir, relPath);
  fs.writeFileSync(abs, content);
  let out = '';
  try {
    out = execFileSync('node', [DISPATCHER], {
      encoding: 'utf-8',
      input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: abs } }),
      timeout: 15000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    });
  } catch (err) {
    out = (err.stdout || '') + (err.stderr || '');
  }
  return [...out.matchAll(/console\.log line (\d+)/g)].map((m) => Number(m[1]));
}

describe('code-check console.log — 코드 구간만 검사', () => {
  it('JSDoc 예시의 console.log 는 P1 이 아니다', () => {
    const src = [
      '/**',
      ' * 사용 예:',
      ' * console.log(result);',
      ' */',
      'export function noop() { return 1; }',
    ].join('\n');
    expect(consoleFindings('src/lib/a.ts', src)).toEqual([]);
  });

  it('템플릿 리터럴 안의 console.log 는 P1 이 아니다', () => {
    const src = [
      'export const doc = `',
      '# 사용법',
      'node -e "t.run().then(r => console.log(r))"',
      '`;',
    ].join('\n');
    expect(consoleFindings('src/lib/b.ts', src)).toEqual([]);
  });

  it('한 줄 주석의 console.log 는 P1 이 아니다', () => {
    const src = ['export function f() {', '  // console.log(x);', '  return 1;', '}'].join('\n');
    expect(consoleFindings('src/lib/c.ts', src)).toEqual([]);
  });

  it('진짜 호출은 여전히 P1 으로 잡는다', () => {
    const src = ['export function f() {', '  console.log("debug");', '  return 1;', '}'].join('\n');
    expect(consoleFindings('src/lib/d.ts', src)).toEqual([2]);
  });

  it('주석·템플릿과 진짜 호출이 섞이면 코드 구간만 잡는다', () => {
    const src = [
      '/**',
      ' * console.log(doc);',          // 2 — 주석
      ' */',
      'export const t = `',
      'console.log(template);',        // 5 — 템플릿
      '`;',
      'export function f() {',
      '  console.log("real");',        // 8 — 진짜
      '}',
    ].join('\n');
    expect(consoleFindings('src/lib/e.ts', src)).toEqual([8]);
  });

  it('qualityCheck.consoleAllow 로 정당한 예외를 등록할 수 있다', () => {
    fs.mkdirSync(path.join(projectDir, '.vibe'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, '.vibe', 'config.json'),
      JSON.stringify({ qualityCheck: { consoleAllow: ['src/lib/allowed.ts'] } })
    );
    const src = 'export function f() {\n  console.log("banner");\n}';
    expect(consoleFindings('src/lib/allowed.ts', src)).toEqual([]);
  });
});
