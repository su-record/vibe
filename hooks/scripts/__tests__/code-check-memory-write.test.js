/**
 * code-check.js — C1 회귀 테스트: SQLite addObservation 조건화
 *
 * 검증 대상:
 *   - 무위반(clean) Edit → memories.db 자체가 생성되지 않음 (SQLite write 없음)
 *   - 위반(violation) Edit → memories.db 생성 (addObservation 기록)
 *   - 코드 확장자가 아닌 파일 → 동적 import 전 조기 반환 (write 없음)
 *
 * dist 빌드 필요 (BASE_URL = dist/tools) — `npm run build` 이후 실행.
 * 패턴: 훅 스크립트 공통의 spawnSync 방식 (post-edit-dispatcher.test.js 참고).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'code-check.js');

/**
 * 격리된 임시 프로젝트에서 code-check 를 1회 실행.
 * stdin 으로 PostToolUse payload 전달.
 */
function runCodeCheck({ filePath, projectDir }) {
  const payload = { tool_name: 'Edit', tool_input: { file_path: filePath } };
  return spawnSync('node', [SCRIPT], {
    input: JSON.stringify(payload),
    encoding: 'utf-8',
    timeout: 15000,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });
}

function memoriesDbPath(projectDir) {
  return path.join(projectDir, '.vibe', 'memories', 'memories.db');
}

describe('code-check.js: 위반 시에만 SQLite 기록 (C1)', () => {
  let projectDir;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-code-check-'));
  });

  afterEach(() => {
    try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('무위반 TS 파일 편집 → memories.db 미생성 (SQLite write 없음)', () => {
    const filePath = path.join(projectDir, 'clean.ts');
    fs.writeFileSync(filePath, 'export function add(a: number, b: number): number {\n  return a + b;\n}\n');

    const result = runCodeCheck({ filePath, projectDir });

    expect(result.status).toBe(0);
    expect(fs.existsSync(memoriesDbPath(projectDir))).toBe(false);
  });

  it('any 타입 위반이 있는 TS 파일 편집 → memories.db 생성 (SQLite write 발생)', () => {
    const filePath = path.join(projectDir, 'dirty.ts');
    fs.writeFileSync(filePath, 'export function foo(x: any): any {\n  return x;\n}\n');

    const result = runCodeCheck({ filePath, projectDir });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('any-type');
    expect(fs.existsSync(memoriesDbPath(projectDir))).toBe(true);
  });

  it('코드 확장자가 아닌 파일(.md) → 동적 import 조기 반환, memories.db 미생성', () => {
    const filePath = path.join(projectDir, 'notes.md');
    fs.writeFileSync(filePath, "console.log('should not trigger memory write')\n");

    const result = runCodeCheck({ filePath, projectDir });

    expect(result.status).toBe(0);
    expect(fs.existsSync(memoriesDbPath(projectDir))).toBe(false);
  });
});
