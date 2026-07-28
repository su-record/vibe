/**
 * postinstall 실패 가시성 계약 (REQ-audit-p2-remediation-002)
 *
 * 배경: postinstall 이 `.catch(()=>{})` 로 모든 실패를 삼켜, dist 누락·손상으로
 * 에셋과 훅이 설치되지 않아도 npm 은 성공으로 보고했다. CLAUDE.md 가 "훅은
 * 프로젝트 로컬 아티팩트라 누락되기 쉽다" 고 경고하는 바로 그 지점이 침묵했다.
 *
 * main() 내부 오류는 이미 console.warn 으로 보고되므로, 여기서 고정하는 것은
 * **모듈 임포트 자체가 실패하는 경로** 다 — 그때가 가장 조용했다.
 *
 * 성공 경로는 실제 설치를 수행(~/.vibe, ~/.cursor 쓰기)하므로 테스트하지 않는다.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

function postinstallScript(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')) as {
    scripts: Record<string, string>;
  };
  return pkg.scripts.postinstall;
}

/** package.json 의 실제 postinstall 명령을, dist 가 없는 임시 cwd 에서 실행한다 */
function runInEmptyDir(): { status: number | null; stderr: string; stdout: string } {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-postinstall-'));
  try {
    const r = spawnSync(postinstallScript(), { cwd: tmp, shell: true, encoding: 'utf-8', timeout: 30000 });
    return { status: r.status, stderr: r.stderr ?? '', stdout: r.stdout ?? '' };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

describe('postinstall 실패 가시성', () => {
  it('빈 catch 로 실패를 삼키지 않는다', () => {
    expect(postinstallScript()).not.toMatch(/catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/);
  });

  it('셸 명령 치환을 유발하는 문자를 담지 않는다', () => {
    // npm 은 postinstall 을 sh -c 로 실행한다. 큰따옴표 안의 백틱/$( ) 는 그대로
    // 명령 치환되어 설치 중에 임의 명령이 실행된다 (실제로 `npx vibe upgrade` 가 돌았다).
    expect(postinstallScript()).not.toMatch(/`/);
    expect(postinstallScript()).not.toMatch(/\$\(/);
  });

  it('임포트 실패 시 stderr 로 원인을 알린다', () => {
    const { stderr } = runInEmptyDir();
    expect(stderr.trim().length).toBeGreaterThan(0);
    expect(stderr).toMatch(/postinstall/i);
  });

  it('실패해도 종료 코드는 0 — 설치 자체를 깨뜨리지 않는다', () => {
    // 에셋/훅은 선택적 자산이므로 설치 실패가 npm install 을 실패시켜서는 안 된다
    expect(runInEmptyDir().status).toBe(0);
  });

  it('사용자가 복구할 방법을 함께 알려준다', () => {
    // 교착 상황의 사용자는 문서를 찾아보지 않는다 — 메시지가 스스로 복구법을 담아야 한다
    expect(runInEmptyDir().stderr).toMatch(/vibe upgrade/);
  });
});
