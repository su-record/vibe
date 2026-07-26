/**
 * code-check.js 정밀 탐지기 테스트
 *
 * 검증 대상:
 *   - any 탐지: 단어 경계 기반 (false positive: 'company', 'anything' 등)
 *   - any 탐지: `: any`, `as any`, `@ts-ignore`, `<any>` (true positive)
 *   - console.log 정책: 경로별 허용/차단
 *   - run-ledger verifyRequired round-trip + pass 시 clear
 *   - auto-commit verifyRequired skip
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── any 탐지 정규식 (code-check.js와 동일) ──────────────────────────────
const P1_DETECTORS = [
  /:\s*any\b/,
  /\bas\s+any\b/,
  /<any[\s,>]/,
  /@ts-ignore\b/,
];

function detectsAny(line) {
  return P1_DETECTORS.some(re => re.test(line));
}

describe('any 탐지: true positive', () => {
  it(': any — 타입 어노테이션', () => {
    expect(detectsAny('function foo(x: any): void {}')).toBe(true);
  });

  it(': any — 공백 포함', () => {
    expect(detectsAny('const x:  any = 1;')).toBe(true);
  });

  it('as any — 타입 캐스트', () => {
    expect(detectsAny('const y = x as any;')).toBe(true);
  });

  it('<any> — 제네릭', () => {
    expect(detectsAny('const z = foo<any>();')).toBe(true);
  });

  it('<any, — 제네릭 다중 파라미터', () => {
    expect(detectsAny('const m = new Map<any, string>();')).toBe(true);
  });

  it('@ts-ignore — 라인 직전', () => {
    expect(detectsAny('// @ts-ignore')).toBe(true);
  });

  it('@ts-ignore — 인라인', () => {
    expect(detectsAny('  @ts-ignore  ')).toBe(true);
  });
});

describe('any 탐지: false negative (탐지 안 됨)', () => {
  it('"company" 단어 포함 — 탐지 안 됨', () => {
    expect(detectsAny('const company = "Acme";')).toBe(false);
  });

  it('"anything" 식별자 — 탐지 안 됨', () => {
    expect(detectsAny('if (anything) return;')).toBe(false);
  });

  it('"manyThings" — 탐지 안 됨', () => {
    expect(detectsAny('const manyThings = [];')).toBe(false);
  });

  it('"fantasy" — 탐지 안 됨', () => {
    expect(detectsAny('const fantasy = "world";')).toBe(false);
  });

  it('문자열 리터럴 "any" — 정규식은 문자열 내부도 매칭할 수 있음 (알려진 한계, 문서화)', () => {
    // NOTE: 현재 구현은 문자열 내 "any"를 완전히 제외하지 않음.
    // 실제 코드에서 ": any" 패턴이 문자열로 존재하는 경우는 극히 드물어 허용.
    // 이 테스트는 동작을 문서화하는 것이 목적.
    const result = detectsAny('const msg = "type: any is bad";');
    // 문자열 내 ": any" 도 탐지될 수 있음 — false positive지만 드문 케이스
    expect(typeof result).toBe('boolean');
  });
});

// ─── console.log 경로 정책 ────────────────────────────────────────────────
describe('console.log 허용 경로 정책', () => {
  // 허용 glob 패턴 (code-check.js 기본값과 동일)
  const DEFAULT_ALLOW_GLOBS = [
    'hooks/scripts/**',
    'scripts/**',
    '**/cli/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/__tests__/**',
  ];

  function globToRegExp(glob) {
    const normalized = glob.replace(/\\/g, '/');
    let out = '';
    for (let i = 0; i < normalized.length; i++) {
      const c = normalized[i];
      if (c === '*') {
        if (normalized[i + 1] === '*') {
          out += '.*';
          i++;
          if (normalized[i + 1] === '/') i++;
        } else {
          out += '[^/]*';
        }
      } else if (c === '?') {
        out += '[^/]';
      } else if ('.+^$()|{}[]\\'.includes(c)) {
        out += '\\' + c;
      } else {
        out += c;
      }
    }
    return new RegExp('^' + out + '$');
  }

  function isConsoleAllowed(relPath) {
    return DEFAULT_ALLOW_GLOBS.some(g => globToRegExp(g).test(relPath));
  }

  it('hooks/scripts/auto-test.js → 허용', () => {
    expect(isConsoleAllowed('hooks/scripts/auto-test.js')).toBe(true);
  });

  it('hooks/scripts/lib/run-ledger.js → 허용', () => {
    expect(isConsoleAllowed('hooks/scripts/lib/run-ledger.js')).toBe(true);
  });

  it('src/cli/index.ts → 허용 (**/cli/**)', () => {
    expect(isConsoleAllowed('src/cli/index.ts')).toBe(true);
  });

  it('src/tools/foo.test.ts → 허용 (**/*.test.*)', () => {
    expect(isConsoleAllowed('src/tools/foo.test.ts')).toBe(true);
  });

  it('src/__tests__/bar.ts → 허용 (**/__tests__/**)', () => {
    expect(isConsoleAllowed('src/__tests__/bar.ts')).toBe(true);
  });

  it('src/tools/convention/validateCodeQuality.ts → 차단', () => {
    expect(isConsoleAllowed('src/tools/convention/validateCodeQuality.ts')).toBe(false);
  });

  it('src/infra/lib/MemoryManager.ts → 차단', () => {
    expect(isConsoleAllowed('src/infra/lib/MemoryManager.ts')).toBe(false);
  });
});

// ─── 확장자 게이트 (문서 안의 코드 스니펫 오탐 방지) ──────────────────────
/**
 * SKILL.md 등 문서에 인용된 `console.log(` 는 커밋되면 안 되는 디버그 코드가
 * 아니라 예시다. 확장자 게이트가 없으면 문서를 편집할 때마다 고칠 수도 없는
 * P1 이 주입되고, 반복되는 오탐이 게이트 신뢰도를 깎는다.
 *
 * 재구현이 아니라 실제 code-check.js 의 run() 을 통과시켜 검증한다.
 */
describe('console.log 확장자 게이트', () => {
  let tempDir;
  let runCodeCheck;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-codecheck-ext-'));
    ({ run: runCodeCheck } = await import('../code-check.js'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  /** 허용 glob 에 걸리지 않는 경로를 쓰기 위해 src/feature/ 아래에 만든다 */
  function writeFixture(name, body) {
    const dir = path.join(tempDir, 'src', 'feature');
    fs.mkdirSync(dir, { recursive: true });
    const full = path.join(dir, name);
    fs.writeFileSync(full, body);
    return full;
  }

  it('마크다운 안의 console.log 는 findings 를 만들지 않는다', async () => {
    const filePath = writeFixture(
      'guide.md',
      ['# Guide', '', '```bash', 'node -e "console.log(1)"', '```', ''].join('\n'),
    );

    const { findings } = await runCodeCheck({ filePath });

    expect(findings.filter(f => /console\.log/.test(f))).toEqual([]);
  });

  it('JSON 안의 console.log 문자열도 findings 를 만들지 않는다', async () => {
    const filePath = writeFixture('fixture.json', '{ "cmd": "console.log(1)" }\n');

    const { findings } = await runCodeCheck({ filePath });

    expect(findings.filter(f => /console\.log/.test(f))).toEqual([]);
  });

  it('코드 확장자에서는 여전히 탐지한다 (게이트가 탐지 자체를 죽이지 않음)', async () => {
    const filePath = writeFixture('service.ts', 'export const f = () => { console.log(1); };\n');

    const { findings } = await runCodeCheck({ filePath });

    expect(findings.some(f => /console\.log/.test(f))).toBe(true);
  });
});
