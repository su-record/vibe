/**
 * 플러그인 훅 이중 실행 가드.
 *
 * 실측: vibe 를 npm 으로 설치하면 프로젝트에 훅 6개가 깔린다. 여기에 플러그인까지
 * 설치하면 같은 6개 이벤트가 **두 벌** 등록돼 모든 게이트가 2회 돌고 Stop 의
 * auto-commit·devlog 도 2회 돈다. 게이트 중복은 느린 정도지만 커밋 중복은 되돌릴
 * 일이 생긴다 — 그래서 플러그인 쪽이 물러난다.
 *
 * 물러나는 기준은 "훅 키가 있다" 가 아니라 "**vibe** 훅이 있다" 다. 사용자가 자기
 * 훅만 넣어둔 프로젝트에서까지 플러그인이 침묵하면 설치한 의미가 없다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { projectHooksInstalled } from '../plugin-hook-entry.js';

let dir;

const writeSettings = (value) => {
  const p = path.join(dir, '.claude', 'settings.local.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof value === 'string' ? value : JSON.stringify(value), 'utf-8');
};

beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-plugin-hook-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('projectHooksInstalled', () => {
  it('설정 파일이 없으면 플러그인이 실행된다', () => {
    expect(projectHooksInstalled(dir)).toBe(false);
  });

  it('vibe 훅이 설치돼 있으면 플러그인이 물러난다', () => {
    writeSettings({
      hooks: {
        SessionStart: [{ hooks: [{ type: 'command', command: 'node /x/hooks/scripts/session-start.js' }] }],
      },
    });
    expect(projectHooksInstalled(dir)).toBe(true);
  });

  it('사용자 자작 훅만 있으면 물러나지 않는다 — 중복이 아니다', () => {
    writeSettings({
      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'make lint' }] }] },
    });
    expect(projectHooksInstalled(dir)).toBe(false);
  });

  it('hooks 키가 없으면 물러나지 않는다', () => {
    writeSettings({ permissions: {} });
    expect(projectHooksInstalled(dir)).toBe(false);
  });

  it('손상된 설정 파일은 미설치로 본다 — 판독 불가로 게이트를 끄지 않는다', () => {
    writeSettings('{ broken');
    expect(projectHooksInstalled(dir)).toBe(false);
  });
});
