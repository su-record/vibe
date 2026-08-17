/**
 * 프로젝트 훅 staleness 판정.
 *
 * 실측한 사건(v3.2.35): PostToolUse matcher 에 `Agent` 를 추가해 배포했는데,
 * upgrade 를 돌린 뒤에도 `.claude/settings.local.json` 은 옛 matcher 그대로였다.
 * `repairProjectHooks` 가 **부재**만 봤기 때문이다 — 훅 키가 있으면 최신으로
 * 취급했다. 즉 훅 내용 수정은 **이미 설치한 사용자에게 영영 도달하지 않았다.**
 *
 * 전역 자산은 `staleGlobalAssets` 로 같은 문제를 막아뒀는데 프로젝트 훅에는
 * 그 장치가 없었다. 이 테스트가 그 비대칭을 고정한다.
 *
 * 판정이 보수적인 이유: `settings.local.json` 에는 사용자의 permissions 등도
 * 들어 있다. 판독 불가나 미설치를 stale 로 읽으면 사용자 설정을 함부로 덮는다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { projectHooksStale } from './ProjectSetup.js';

const TEMPLATE = path.resolve(__dirname, '..', '..', '..', 'hooks', 'hooks.json');

let root: string;

const writeSettings = (value: unknown): void => {
  const dir = path.join(root, '.claude');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'settings.local.json'),
    typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  );
};

/** 템플릿을 실제 설치와 같은 방식으로 치환한 결과 */
const installedShape = (): { hooks: unknown } =>
  JSON.parse(
    fs.readFileSync(TEMPLATE, 'utf-8')
      .replace(/\{\{VIBE_PATH\}\}/g, (process.env.HOME ?? '/home/x').replace(/\\/g, '/') + '/.vibe'),
  ) as { hooks: unknown };

beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-hooks-stale-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('projectHooksStale', () => {
  it('훅이 아예 없으면 stale 이 아니다 — 미설치는 별개 사건이다', () => {
    writeSettings({ permissions: { allow: [] } });
    expect(projectHooksStale(root, '.claude')).toBe(false);
  });

  it('설정 파일이 없으면 stale 이 아니다', () => {
    expect(projectHooksStale(root, '.claude')).toBe(false);
  });

  it('손상된 설정 파일은 stale 로 보지 않는다 — 판독 불가로 사용자 설정을 덮지 않는다', () => {
    writeSettings('{ broken');
    expect(projectHooksStale(root, '.claude')).toBe(false);
  });

  /**
   * 이 케이스가 v3.2.35 에서 실제로 일어난 일이다 — matcher 한 토큰 차이로
   * 에이전트 집계가 통째로 죽었는데 upgrade 는 "복구할 것 없음" 이라고 답했다.
   */
  it('matcher 한 토큰만 달라도 stale 로 잡는다', () => {
    const doc = installedShape();
    const json = JSON.stringify(doc).replace('|Agent|', '|');
    writeSettings(JSON.parse(json));
    expect(projectHooksStale(root, '.claude')).toBe(true);
  });

  it('훅 외의 사용자 설정이 달라도 stale 이 아니다 — hooks 만 비교한다', () => {
    writeSettings({ ...installedShape(), permissions: { allow: ['Bash(ls:*)'] } });
    expect(projectHooksStale(root, '.claude')).toBe(false);
  });
});
