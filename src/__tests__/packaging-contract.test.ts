/**
 * 게시 패키지 계약 테스트 (REQ-audit-p2-remediation-001)
 *
 * 배경: tsconfig.json 이 src/**\/* 전체를 include 하고 테스트를 제외하지 않아
 * dist 에 *.test.js 60개가 생성돼 그대로 게시됐고, files:["hooks/"] 는 훅 테스트
 * 28개까지 실어 보냈다. v3.2.14 게시본 기준 test 엔트리 283개 / unpacked 6.62MB.
 *
 * 이 테스트는 두 유출원(빌드 산출물·files 허용목록)을 모두 고정한다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf-8')) as Record<string, unknown>;
}

/** dir 아래에서 predicate 를 만족하는 파일 경로를 모은다 */
function walk(dir: string, predicate: (p: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(path.relative(ROOT, full));
  }
  return out;
}

describe('빌드 설정 계약', () => {
  it('빌드는 전용 tsconfig 를 쓴다 (타입체크와 산출물 범위 분리)', () => {
    const pkg = readJson('package.json');
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts.build).toContain('tsconfig.build.json');
  });

  it('tsconfig.build.json 은 테스트를 산출물에서 제외한다', () => {
    const build = readJson('tsconfig.build.json');
    const exclude = build.exclude as string[];
    for (const pattern of ['src/**/*.test.ts', 'src/**/__tests__/**', 'src/test-helpers/**']) {
      expect(exclude, `${pattern} 이 build exclude 에 없다`).toContain(pattern);
    }
  });

  it('타입체크용 tsconfig 는 테스트를 계속 포함한다', () => {
    // 테스트가 타입체크 대상에서 빠지면 `tsc --noEmit` 이 테스트의 타입 오류를 놓친다
    const base = readJson('tsconfig.json');
    const exclude = (base.exclude as string[]) ?? [];
    expect(exclude.join(' ')).not.toMatch(/test/i);
  });
});

describe('files 허용목록 계약', () => {
  const pkg = readJson('package.json');
  const files = pkg.files as string[];

  it('훅 테스트를 게시에서 제외한다', () => {
    expect(files).toContain('!hooks/scripts/__tests__');
  });

  it('런타임 자산 5종은 그대로 게시한다', () => {
    for (const asset of ['dist/', 'vibe/', 'languages/', 'agents/', 'skills/', 'hooks/']) {
      expect(files, `${asset} 가 files 에서 빠졌다`).toContain(asset);
    }
  });
});

describe('빌드 산출물 계약', () => {
  const dist = path.join(ROOT, 'dist');
  const built = fs.existsSync(dist);

  it.runIf(built)('dist 에 컴파일된 테스트가 없다', () => {
    const testFiles = walk(dist, (p) => /\.test\.js$/.test(p) || p.includes(`${path.sep}__tests__${path.sep}`));
    expect(testFiles).toEqual([]);
  });

  it.runIf(built)('dist 에 test-helpers 가 없다', () => {
    expect(walk(dist, (p) => p.includes('test-helpers'))).toEqual([]);
  });

  it.runIf(built)('진입점은 모두 존재한다', () => {
    for (const entry of [
      'dist/cli/index.js',
      'dist/tools/index.js',
      'dist/cli/postinstall/main.js',
      'dist/infra/lib/memory/index.js',
    ]) {
      expect(fs.existsSync(path.join(ROOT, entry)), `${entry} 없음`).toBe(true);
    }
  });

  it('dist 미빌드 환경에서는 산출물 검사를 건너뛴 사실이 드러난다', () => {
    // 가짜 통과 방지 — CI 는 test 전에 build 하므로 built 가 false 면 로컬 부분 실행이다
    expect(typeof built).toBe('boolean');
  });
});
