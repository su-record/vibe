/**
 * engines.node 계약 테스트
 *
 * `package.json` 의 engines.node 는 프로덕션 의존성이 실제로 요구하는 최소 Node
 * 버전보다 낮으면 안 된다. 낮으면 npm 이 "지원됨" 이라고 안내한 환경에서
 * better-sqlite3 네이티브 빌드가 깨지거나 런타임에 실패한다.
 *
 * 배경: v3.2.13 까지 engines.node 가 ">=18.0.0" 이었으나 better-sqlite3 는 Node 20+,
 * @clack/prompts 는 20.12+ 를 요구했다. 둘 다 optionalDependencies 가 아니라
 * dependencies 이므로 Node 18 사용자에게 그대로 도달했다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

interface PkgJson {
  engines?: { node?: string };
  dependencies?: Record<string, string>;
}

function readJson(file: string): PkgJson {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as PkgJson;
}

/**
 * engines 범위 문자열에서 허용되는 최소 버전을 [major, minor] 로 뽑는다.
 * `20.x || 22.x || 23.x` → [20, 0] · `>= 20.12.0` → [20, 12] · `18 || 20 || >=22` → [18, 0]
 */
function minSupported(range: string): [number, number] {
  // 버전 토큰은 통째로 잡는다 — `\d+(\.\d+)?` 로 자르면 "20.12.0" 이 ["20.12", "0"] 이 된다
  const tokens = range.match(/\d+(?:\.\d+)*/g) ?? [];
  const versions: Array<[number, number]> = tokens.map((t) => {
    const [maj, min] = t.split('.');
    return [Number(maj), Number(min ?? 0)];
  });
  if (versions.length === 0) return [0, 0];
  return versions.reduce((lo, v) => (v[0] !== lo[0] ? (v[0] < lo[0] ? v : lo) : v[1] < lo[1] ? v : lo));
}

function gte(a: [number, number], b: [number, number]): boolean {
  return a[0] !== b[0] ? a[0] > b[0] : a[1] >= b[1];
}

const rootPkg = readJson(path.join(ROOT, 'package.json'));
const declared = minSupported(rootPkg.engines?.node ?? '');

describe('engines.node 계약', () => {
  it('engines.node 가 선언돼 있다', () => {
    expect(rootPkg.engines?.node).toBeTruthy();
  });

  it('모든 프로덕션 의존성의 최소 Node 요구를 만족한다', () => {
    const deps = Object.keys(rootPkg.dependencies ?? {});
    expect(deps.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const dep of deps) {
      const depPkgPath = path.join(ROOT, 'node_modules', dep, 'package.json');
      if (!fs.existsSync(depPkgPath)) continue; // 미설치 환경에서는 건너뛴다
      const depRange = readJson(depPkgPath).engines?.node;
      if (!depRange) continue;

      const required = minSupported(depRange);
      if (!gte(declared, required)) {
        violations.push(
          `${dep} requires node "${depRange}" (min ${required.join('.')}) but package.json declares "${rootPkg.engines?.node}"`
        );
      }
    }

    expect(violations).toEqual([]);
  });

  it('README 의 Node 요구사항이 package.json 과 일치한다', () => {
    for (const readme of ['README.md', 'README.en.md']) {
      const text = fs.readFileSync(path.join(ROOT, readme), 'utf-8');
      const match = text.match(/Node\.js\s*>=\s*(\d+\.\d+\.\d+)/);
      expect(match, `${readme} 에 "Node.js >= X.Y.Z" 요구사항 줄이 없다`).toBeTruthy();
      expect(minSupported(match![1]), `${readme} 의 Node 요구사항이 package.json 과 다르다`).toEqual(declared);
    }
  });
});
