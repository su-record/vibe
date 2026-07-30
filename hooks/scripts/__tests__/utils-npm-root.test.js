/**
 * utils.js — getGlobalNpmPath() 파일 캐시 테스트
 *
 * 검증 범위:
 *  - L2 파일 캐시 히트 (TTL 내)
 *  - L2 파일 캐시 만료 (TTL 초과)
 *  - 캐시 파일 손상 시 fail-open (execSync 재실행)
 *  - 캐시 파일 없음 시 execSync 실행 후 파일 저장
 *
 * 격리 전략: 각 테스트는 별도 임시 디렉토리를 캐시 경로로 사용한다.
 * NPM_ROOT_CACHE_FILE 환경 변수를 통해 경로를 주입한다.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Windows 절대경로(C:\...)는 ESM import 지정자가 될 수 없으므로 file:// URL로 변환
const UTILS_URL = pathToFileURL(path.resolve(__dirname, '..', 'utils.js')).href;

function makeTempCacheFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-npm-root-test-'));
  return path.join(dir, 'npm-root.json');
}

/**
 * utils.js 의 getGlobalNpmPath() 를 별도 프로세스에서 실행.
 * VIBE_NPM_ROOT_CACHE_FILE 환경 변수로 캐시 파일 경로를 주입한다.
 */
function runGetNpmRoot(cacheFilePath) {
  return spawnSync(process.execPath, ['--input-type=module', '--eval',
    `import { getGlobalNpmPath } from '${UTILS_URL}';
     process.stdout.write(getGlobalNpmPath() || '');`
  ], {
    encoding: 'utf-8',
    timeout: 10000,
    env: {
      ...process.env,
      VIBE_NPM_ROOT_CACHE_FILE: cacheFilePath,
    },
  });
}

describe('utils.js — getGlobalNpmPath() npm-root 파일 캐시', () => {
  it('캐시 파일 없으면 execSync 실행 후 캐시 파일 생성', () => {
    const cacheFile = makeTempCacheFile();
    // 캐시 파일이 없는 상태에서 시작
    expect(fs.existsSync(cacheFile)).toBe(false);

    const result = runGetNpmRoot(cacheFile);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBeTruthy();

    // 캐시 파일이 생성되어야 함
    expect(fs.existsSync(cacheFile)).toBe(true);
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    expect(cached.npmRoot).toBe(result.stdout.trim());
    expect(typeof cached.savedAt).toBe('number');
  });

  it('유효한 캐시 파일이 있으면 execSync 없이 캐시값 반환', () => {
    const cacheFile = makeTempCacheFile();
    const fakeRoot = '/fake/npm/root/for/test';
    // 유효한 캐시 미리 작성
    fs.writeFileSync(cacheFile, JSON.stringify({ npmRoot: fakeRoot, savedAt: Date.now() }), { mode: 0o600 });

    const result = runGetNpmRoot(cacheFile);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(fakeRoot);
  });

  it('TTL 초과 캐시는 무효화 — execSync 재실행', () => {
    const cacheFile = makeTempCacheFile();
    const staleRoot = '/stale/path/should/not/be/used';
    const expiredAt = Date.now() - (25 * 60 * 60 * 1000); // 25시간 전
    fs.writeFileSync(cacheFile, JSON.stringify({ npmRoot: staleRoot, savedAt: expiredAt }), { mode: 0o600 });

    const result = runGetNpmRoot(cacheFile);
    expect(result.status).toBe(0);
    // stale 값이 아닌 실제 npm root 가 반환되어야 함
    expect(result.stdout.trim()).not.toBe(staleRoot);
    expect(result.stdout.trim()).toBeTruthy();
  });

  it('손상된 캐시 파일 — fail-open (execSync 실행)', () => {
    const cacheFile = makeTempCacheFile();
    fs.writeFileSync(cacheFile, '{ broken json :::');

    const result = runGetNpmRoot(cacheFile);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBeTruthy(); // 실제 경로 반환
    // 손상된 파일 때문에 프로세스가 crash 나지 않아야 함
    const stderr = result.stderr || '';
    expect(stderr).not.toMatch(/^Error:/m);
  });
});

/**
 * npm 이 PATH 에 없고 캐시도 없을 때의 폴백 — 격리 서버 회귀.
 *
 * 재현했던 결함: 폴백 후보가 /usr/local·~/.npm-global·~/.nvm 뿐이라, 배포판 npm
 * (prefix=/usr → /usr/lib/node_modules)이나 사용자 prefix(~/.local)에 설치된
 * 환경에서 존재하지 않는 /usr/local/lib/node_modules 를 루트로 확정했다.
 * 그 뒤 모든 동적 import 가 조용히 실패해 도구 계층 전체가 죽었다.
 */
describe('getGlobalNpmPath — npm 부재 시 폴백', () => {
  /** npm 을 뺀 PATH 로 실행한다 (node 만 심볼릭 링크로 남긴다) */
  function runWithoutNpm(cacheFilePath, extraEnv = {}) {
    const stub = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-nonpm-'));
    fs.symlinkSync(process.execPath, path.join(stub, 'node'));
    try {
      return spawnSync(process.execPath, ['--input-type=module', '--eval',
        `import { getGlobalNpmPath } from '${UTILS_URL}';
         process.stdout.write(getGlobalNpmPath() || '');`
      ], {
        encoding: 'utf-8',
        timeout: 10000,
        env: {
          PATH: stub,
          HOME: process.env.HOME,
          VIBE_NPM_ROOT_CACHE_FILE: cacheFilePath,
          ...extraEnv,
        },
      });
    } finally {
      fs.rmSync(stub, { recursive: true, force: true });
    }
  }

  it('패키지가 실제로 있는 prefix 를 고른다', () => {
    const result = runWithoutNpm(makeTempCacheFile());
    expect(result.status).toBe(0);

    const chosen = result.stdout.trim();
    expect(chosen).toBeTruthy();
    // 폴백이 지어낸 경로가 아니라, @su-record/vibe 가 실제로 있는 곳이어야 한다
    expect(
      fs.existsSync(path.join(chosen, '@su-record', 'vibe')),
      `선택된 prefix 에 패키지가 없다: ${chosen}`,
    ).toBe(true);
  });

  it('폴백이 /usr/local 로 고정되지 않는다', () => {
    const result = runWithoutNpm(makeTempCacheFile());
    const chosen = result.stdout.trim();
    // 이 저장소의 실제 설치 prefix 는 /usr/local 이 아니다 — 하드코딩 회귀 감지
    if (!fs.existsSync('/usr/local/lib/node_modules/@su-record/vibe')) {
      expect(chosen).not.toBe('/usr/local/lib/node_modules');
    }
  });
});
