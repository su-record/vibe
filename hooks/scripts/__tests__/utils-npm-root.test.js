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
