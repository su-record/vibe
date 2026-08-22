/**
 * OS cron 으로 루프를 걸 때의 계약.
 *
 * cron 은 로그인 셸의 환경을 물려받지 않는다 — 보통 `PATH=/usr/bin:/bin` 만 들고
 * 실행한다. 그런데 `claude` 는 거기 없다: nvm(`~/.nvm/versions/.../bin`),
 * Homebrew(`/usr/local/bin`), `~/.local/bin` 중 어디든 cron 기본 PATH 밖이다.
 *
 * 실측: `env -i PATH=/usr/bin:/bin sh -c 'command -v claude'` → 없음.
 *
 * 그래서 PATH 를 적지 않은 crontab 은 **아무 소리 없이** 한 번도 돌지 않는다.
 * 스케줄 루프에서 이건 최악의 실패 형태다 — 사람이 안 보는 동안 도는 것이 목적인데,
 * 안 도는 것도 안 보인다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const ADAPTERS = fs.readFileSync(
  path.join(ROOT, 'skills', 'vibe.loop', 'references', 'install-adapters.md'), 'utf-8');

describe('cron 설치 안내', () => {
  it('PATH 를 명시하라고 적는다', () => {
    expect(ADAPTERS, 'PATH 없는 crontab 은 조용히 한 번도 돌지 않는다')
      .toMatch(/^PATH=/m);
  });

  it('claude 의 실제 경로를 찾는 방법을 알려준다', () => {
    expect(ADAPTERS).toContain('which claude');
  });

  /** cron 은 출력을 메일로 보내거나 버린다 — 파일로 받지 않으면 실패 원인을 알 수 없다 */
  it('로그 리다이렉트를 포함한다', () => {
    expect(ADAPTERS).toMatch(/2>&1/);
  });

  /** 다음 실행 시각까지 기다렸다 실패를 발견하면 진단이 하루 늦는다 */
  it('등록 직후 최소 환경에서 1회 검증하라고 적는다', () => {
    expect(ADAPTERS).toMatch(/env -i/);
  });
});
