/**
 * 의존성 해석 파이프라인 계약 (REQ-audit-p2-remediation-003, -004)
 *
 * 배경: packageManager 선언이 없고 CI 3곳이 `--frozen-lockfile=false` 라, 커밋된
 * 락파일과 다른 트리로 빌드·게시될 수 있었다. 로컬은 npm, CI 는 pnpm 을 쓰는데
 * 둘이 갈라져도 아무도 잡지 못했다.
 *
 * 취약점 주의: 이 저장소의 락파일은 **게시되지 않는다**. 소비자는 캐럿 범위로
 * 스스로 해석하므로(glob → minimatch@^10.2.2 → brace-expansion@^5.0.8) 패치본을
 * 자동 수신한다. 따라서 아래 핀 검사는 소비자 보안이 아니라 **CI 가 취약 트리로
 * 돌지 않게 하는 개발 환경 위생** 이다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')) as {
  packageManager?: string;
};
const lockfile = fs.readFileSync(path.join(ROOT, 'pnpm-lock.yaml'), 'utf-8');

const WORKFLOWS = ['.github/workflows/test.yml', '.github/workflows/release.yml'];

function workflowText(): Array<[string, string]> {
  return WORKFLOWS.map((w) => [w, fs.readFileSync(path.join(ROOT, w), 'utf-8')]);
}

describe('패키지 매니저 정합', () => {
  it('packageManager 가 pnpm 버전으로 고정돼 있다', () => {
    expect(pkg.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
  });

  /**
   * 버전은 `packageManager` 한 곳에만 선언한다.
   *
   * 원래 이 테스트는 워크플로가 `version:` 을 **선언하도록** 강제했는데, 그 구성은
   * 실행이 불가능하다 — `pnpm/action-setup@v4` 는 action 설정과 `packageManager` 에
   * 버전이 동시에 있으면 ERR_PNPM_BAD_PM_VERSION 을 피하려 즉시 실패한다
   * ("Multiple versions of pnpm specified"). v3.2.15 릴리즈가 이 조합으로 9초 만에
   * 죽었다. action 은 `packageManager` 를 스스로 읽으므로 그쪽이 SSOT 다.
   */
  it('워크플로가 pnpm 버전을 중복 선언하지 않는다', () => {
    for (const [name, text] of workflowText()) {
      expect(text, `${name} 에 pnpm/action-setup 이 없다`).toContain('pnpm/action-setup@');
      expect(
        [...text.matchAll(/pnpm\/action-setup@v\d+[^\n]*\n\s*with:\s*\n\s*version:/g)],
        `${name} 이 packageManager 와 별도로 pnpm 버전을 선언한다 — action 이 실패한다`,
      ).toHaveLength(0);
    }
  });
});

describe('CI 락파일 불변성', () => {
  it('CI 가 frozen lockfile 로 설치한다', () => {
    for (const [name, text] of workflowText()) {
      expect(text, `${name} 이 아직 --frozen-lockfile=false 를 쓴다`).not.toContain('--frozen-lockfile=false');
      expect(text, `${name} 에 pnpm install 이 없다`).toContain('pnpm install --frozen-lockfile');
    }
  });
});

describe('락파일 취약 핀', () => {
  it('brace-expansion 이 패치본(5.0.8+)으로 고정돼 있다', () => {
    const pins = [...lockfile.matchAll(/^ {2}brace-expansion@(\d+)\.(\d+)\.(\d+)/gm)];
    expect(pins.length, 'brace-expansion 핀을 찾지 못했다').toBeGreaterThan(0);
    for (const [, major, minor, patch] of pins) {
      const v = [Number(major), Number(minor), Number(patch)];
      const ok = v[0] > 5 || (v[0] === 5 && (v[1] > 0 || v[2] >= 8));
      expect(ok, `취약한 brace-expansion@${v.join('.')} 가 고정돼 있다 (GHSA-mh99-v99m-4gvg)`).toBe(true);
    }
  });
});
