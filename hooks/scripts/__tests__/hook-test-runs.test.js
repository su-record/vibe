/**
 * hook-test-runs — 훅 프로세스만 쓰는 append-only 기록 (SPEC verify-gate-independence)
 *
 * REQ-verify-gate-independence-001 커버리지:
 *   D1 — post-edit 가 코드 편집을 `edit` 로, auto-test 가 실행 결과를 `auto-test` 로 남긴다
 *   D2 — recordRunStart 가 기록을 비운다
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(__dirname, '..', 'lib', 'hook-test-runs.js');
const LEDGER = path.resolve(__dirname, '..', 'lib', 'run-ledger.js');
const POST_EDIT = path.resolve(__dirname, '..', 'post-edit-dispatcher.js');
const AUTO_TEST = path.resolve(__dirname, '..', 'auto-test.js');

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-hook-runs-'));
});
afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

function writeConfig(projectDir, config) {
  const dir = path.join(projectDir, '.vibe');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config));
}

function runHook(script, payload, projectDir) {
  const env = { ...process.env, CLAUDE_PROJECT_DIR: projectDir };
  delete env.VIBE_HOOK_DEPTH;
  return spawnSync('node', [script], {
    input: JSON.stringify(payload),
    encoding: 'utf-8',
    timeout: 60000,
    env,
  });
}

const STEPS_OFF = {
  hooks: {
    'auto-format': { enabled: false },
    'code-check': { enabled: false },
    'auto-test': { enabled: false },
  },
};

describe('hook-test-runs: append/read/clear', () => {
  it('append → read 왕복, at 은 자동 채움', async () => {
    const { appendHookTestRun, readHookTestRuns } = await import(LIB);
    expect(appendHookTestRun(tmpDir, { kind: 'edit', filePath: 'src/a.ts' })).toBe(true);
    const rows = readHookTestRuns(tmpDir);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('edit');
    expect(rows[0].filePath).toBe('src/a.ts');
    expect(typeof rows[0].at).toBe('string');
  });

  it('알 수 없는 kind 는 기록하지 않는다', async () => {
    const { appendHookTestRun, readHookTestRuns } = await import(LIB);
    expect(appendHookTestRun(tmpDir, { kind: 'model-says-ok' })).toBe(false);
    expect(readHookTestRuns(tmpDir)).toEqual([]);
  });

  it('깨진 줄은 건너뛰고 나머지를 읽는다', async () => {
    const { appendHookTestRun, readHookTestRuns, hookTestRunsPath } = await import(LIB);
    appendHookTestRun(tmpDir, { kind: 'edit', filePath: 'a.ts' });
    fs.appendFileSync(hookTestRunsPath(tmpDir), '{not json\n');
    appendHookTestRun(tmpDir, { kind: 'auto-test', filePath: 'a.test.ts', exitCode: 0 });
    expect(readHookTestRuns(tmpDir).map(r => r.kind)).toEqual(['edit', 'auto-test']);
  });

  it('lastCodeEdit 은 마지막 edit 만 돌려준다', async () => {
    const { appendHookTestRun, lastCodeEdit } = await import(LIB);
    expect(lastCodeEdit(tmpDir)).toBeNull();
    appendHookTestRun(tmpDir, { kind: 'edit', filePath: 'a.ts', at: '2026-01-01T00:00:00.000Z' });
    appendHookTestRun(tmpDir, { kind: 'auto-test', filePath: 'a.test.ts', exitCode: 0, at: '2026-01-01T00:00:01.000Z' });
    appendHookTestRun(tmpDir, { kind: 'edit', filePath: 'b.ts', at: '2026-01-01T00:00:02.000Z' });
    expect(lastCodeEdit(tmpDir)).toMatchObject({ filePath: 'b.ts', at: '2026-01-01T00:00:02.000Z' });
  });

  it('D2 — recordRunStart 가 기록을 비운다', async () => {
    const { appendHookTestRun, readHookTestRuns } = await import(LIB);
    const { recordRunStart } = await import(LEDGER);
    appendHookTestRun(tmpDir, { kind: 'edit', filePath: 'old.ts' });
    expect(readHookTestRuns(tmpDir)).toHaveLength(1);
    expect(recordRunStart(tmpDir, 'feat')).toBe(true);
    expect(readHookTestRuns(tmpDir)).toEqual([]);
  });
});

describe('D1 — 훅이 편집·테스트 사실을 기록한다', () => {
  it('post-edit-dispatcher: 코드 파일 편집 → kind=edit 줄', async () => {
    const { readHookTestRuns } = await import(LIB);
    writeConfig(tmpDir, STEPS_OFF);
    const target = path.join(tmpDir, 'src', 'a.ts');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'export const a = 1;\n');
    const result = runHook(POST_EDIT, { tool_name: 'Edit', tool_input: { file_path: target } }, tmpDir);
    expect(result.status).toBe(0);
    const rows = readHookTestRuns(tmpDir);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'edit', filePath: target });
  });

  it('post-edit-dispatcher: 코드가 아닌 파일 편집은 기록하지 않는다', async () => {
    const { readHookTestRuns } = await import(LIB);
    writeConfig(tmpDir, STEPS_OFF);
    const target = path.join(tmpDir, 'notes.md');
    fs.writeFileSync(target, '# notes\n');
    runHook(POST_EDIT, { tool_name: 'Edit', tool_input: { file_path: target } }, tmpDir);
    expect(readHookTestRuns(tmpDir)).toEqual([]);
  });

  // 가짜 vitest 바이너리는 POSIX 실행 비트·심링크에 의존한다 — Windows 는 auto-test 의
  // 실행 경로 자체가 shell:true 로 갈라지므로 여기서는 검증하지 않는다.
  it.skipIf(process.platform === 'win32')('auto-test: 관련 테스트 실행 → kind=auto-test 줄 (exitCode 포함)', async () => {
    const { readHookTestRuns } = await import(LIB);
    const pkgDir = path.join(tmpDir, 'node_modules', 'vitest');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'vitest', version: '0.0.0-fake', bin: { vitest: 'cli.js' } }));
    fs.writeFileSync(path.join(pkgDir, 'cli.js'), '#!/usr/bin/env node\nprocess.stdout.write("fake vitest ok\\n");\nprocess.exit(0);\n', { mode: 0o755 });
    const binDir = path.join(tmpDir, 'node_modules', '.bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.symlinkSync(path.join('..', 'vitest', 'cli.js'), path.join(binDir, 'vitest'));

    const src = path.join(tmpDir, 'src', 'a.ts');
    fs.mkdirSync(path.dirname(src), { recursive: true });
    fs.writeFileSync(src, 'export const a = 1;\n');
    fs.writeFileSync(path.join(tmpDir, 'src', 'a.test.ts'), 'export {};\n');

    const result = runHook(AUTO_TEST, { tool_name: 'Edit', tool_input: { file_path: src } }, tmpDir);
    expect(result.status).toBe(0);
    const rows = readHookTestRuns(tmpDir).filter(r => r.kind === 'auto-test');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ exitCode: 0, filePath: path.join('src', 'a.test.ts') });
    expect(rows[0].command).toContain('vitest run');
  });
});
