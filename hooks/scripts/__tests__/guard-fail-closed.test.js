/**
 * guard 크래시 시 fail-closed 계약 (REQ-audit-p2-remediation-005)
 *
 * 배경: dispatchInProcess 는 step throw 를 code 1 로 흡수하고, deny 판정은
 * code === 2 만 본다. 따라서 크래시한 guard 는 작업을 **허용**했다 —
 * sentinel-guard·pre-tool-guard·scope-guard 3종 모두 denyOnExit2 다.
 *
 * 설계 결정(사용자, 2026-07-29): 전 guard fail-closed. 그 선택에서는 탈출구가
 * 복구 유일 수단이므로 VIBE_HOOK_FAILCLOSED=0 과 차단 메시지 내 안내가 필수다.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HARNESS = path.resolve(__dirname, 'fixtures', 'crash-harness.js');

function run(mode, env = {}) {
  const r = spawnSync('node', [HARNESS, mode], {
    encoding: 'utf-8',
    input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'src/x.ts' } }),
    timeout: 15000,
    env: { ...process.env, CLAUDE_PROJECT_DIR: __dirname, ...env },
  });
  return { status: r.status, stderr: r.stderr ?? '', stdout: r.stdout ?? '' };
}

describe('guard 크래시 처리', () => {
  it('deny 권한을 가진 guard 가 크래시하면 작업을 차단한다', () => {
    expect(run('deny-guard').status).toBe(2);
  });

  it('deny 권한이 없는 step 크래시는 작업을 막지 않는다', () => {
    // 크래시 격리는 유지 — 로깅용 step 하나가 죽는다고 도구 호출을 막을 이유가 없다
    expect(run('plain-step').status).toBe(0);
  });

  it('크래시는 step 이름과 원인을 stderr 에 남긴다', () => {
    const { stderr } = run('deny-guard');
    expect(stderr).toContain('crashing-guard');
    expect(stderr).toContain('boom');
  });

  it('deny 권한 없는 step 의 크래시도 조용히 넘어가지 않는다', () => {
    const { stderr } = run('plain-step');
    expect(stderr).toContain('crashing-log');
  });

  it('차단 메시지가 스스로 복구 방법을 알려준다', () => {
    // 교착 상황의 사용자는 문서를 찾아볼 수 없다 — 메시지가 탈출구를 담아야 한다
    expect(run('deny-guard').stderr).toContain('VIBE_HOOK_FAILCLOSED=0');
  });

  it('VIBE_HOOK_FAILCLOSED=0 이면 guard 크래시에도 통과한다', () => {
    expect(run('deny-guard', { VIBE_HOOK_FAILCLOSED: '0' }).status).toBe(0);
  });

  it('정상 경로는 영향을 받지 않는다', () => {
    const { status, stderr } = run('none');
    expect(status).toBe(0);
    expect(stderr).not.toContain('crashed');
  });
});
