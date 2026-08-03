import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { isSelfInstall } from './main.js';

/**
 * postinstall 이 개발자의 전역 홈(~/.claude, ~/.vibe)을 덮어쓰는 사고를 막는 가드.
 * 저장소에서 `pnpm install` 만 해도 작업 트리의 자산이 전역에 반영되던 동작이 있었다.
 */
describe('isSelfInstall', () => {
  const packageRoot = path.resolve(__dirname, '..', '..', '..');
  const original = process.env.INIT_CWD;

  afterEach(() => {
    if (original === undefined) delete process.env.INIT_CWD;
    else process.env.INIT_CWD = original;
  });

  it('저장소 루트에서 install 하면 self-install 로 판정한다', () => {
    process.env.INIT_CWD = packageRoot;
    expect(isSelfInstall(packageRoot)).toBe(true);
  });

  it('경로 표기가 달라도 동일 디렉토리면 self-install 이다', () => {
    process.env.INIT_CWD = path.join(packageRoot, 'src', '..');
    expect(isSelfInstall(packageRoot)).toBe(true);
  });

  it('소비자 프로젝트에서 설치하면 self-install 이 아니다', () => {
    process.env.INIT_CWD = path.join(packageRoot, '..', 'some-consumer-app');
    expect(isSelfInstall(packageRoot)).toBe(false);
  });

  it('INIT_CWD 가 없으면 (직접 실행 등) 정상 설치로 간주한다', () => {
    delete process.env.INIT_CWD;
    expect(isSelfInstall(packageRoot)).toBe(false);
  });
});
