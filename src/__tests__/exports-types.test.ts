import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * package.json `exports` 서브패스의 타입 해석 계약.
 *
 * tsconfig 가 node10(`moduleResolution: "node"`)이던 동안에는 이 계약이 검증되지 않았다.
 * node16/nodenext/bundler 소비자는 `exports` 맵을 통해 타입을 찾으므로, 각 서브패스는
 * 명시적 `types` 조건이 있거나 JS 산출물 옆에 같은 이름의 `.d.ts` 가 있어야 한다.
 * 둘 다 없으면 소비자 쪽에서 "could not find a declaration file" 로 깨진다.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.join(ROOT, 'dist');

interface PackageJson {
  exports: Record<string, string | Record<string, string>>;
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')) as PackageJson;
const subpaths = Object.entries(pkg.exports);

/** 서브패스가 타입 소비자에게 제공하는 .d.ts 경로 (없으면 null) */
function declarationFor(target: string | Record<string, string>): string | null {
  if (typeof target === 'object') {
    const explicit = target.types;
    if (explicit) return path.join(ROOT, explicit);
    const fallback = target.default;
    return fallback ? path.join(ROOT, fallback.replace(/\.js$/, '.d.ts')) : null;
  }
  return path.join(ROOT, target.replace(/\.js$/, '.d.ts'));
}

describe('package.json exports — 타입 해석 계약', () => {
  it('서브패스를 하나 이상 선언한다', () => {
    expect(subpaths.length).toBeGreaterThan(0);
  });

  it.runIf(fs.existsSync(DIST))('모든 서브패스가 해석 가능한 .d.ts 를 가진다', () => {
    const missing: string[] = [];

    for (const [subpath, target] of subpaths) {
      const declaration = declarationFor(target);
      if (!declaration) {
        missing.push(`${subpath}: no resolvable target`);
        continue;
      }
      if (!fs.existsSync(declaration)) {
        missing.push(`${subpath}: ${path.relative(ROOT, declaration)} not found`);
      }
    }

    expect(missing).toEqual([]);
  });

  it.runIf(fs.existsSync(DIST))('모든 서브패스의 런타임 진입점이 존재한다', () => {
    const missing: string[] = [];

    for (const [subpath, target] of subpaths) {
      const entry = typeof target === 'object' ? target.default : target;
      if (!entry || !fs.existsSync(path.join(ROOT, entry))) {
        missing.push(`${subpath}: ${entry ?? '(none)'} not found`);
      }
    }

    expect(missing).toEqual([]);
  });

  it('tsconfig 가 node10 해석으로 되돌아가지 않는다', () => {
    const tsconfig = fs.readFileSync(path.join(ROOT, 'tsconfig.json'), 'utf-8');
    const resolution = tsconfig.match(/"moduleResolution"\s*:\s*"([^"]+)"/)?.[1];

    // node10("node"/"node10")은 TS 6 에서 에러, TS 7 에서 동작 중단이며
    // exports 서브패스 타입을 해석하지 못한다.
    expect(resolution).toBeDefined();
    expect(['nodenext', 'node16', 'bundler']).toContain(resolution);
  });
});
