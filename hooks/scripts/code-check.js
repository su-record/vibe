/**
 * PostToolUse Hook - Write/Edit 후 코드 품질 검사 + 관찰 자동 캡처
 *
 * findings를 console.log가 아닌 반환값으로 전달 — 디스패처가 수집해 additionalContext에 주입.
 *
 * 범위 (harness-review-2026-07-01 P1-4):
 * 오탐률이 낮은 결정론적 하드룰(any/@ts-ignore, console.log)만 탐지한다.
 * 함수 길이·중첩 깊이·매직 넘버 같은 휴리스틱은 모델이 컨텍스트 안에서 더
 * 정확히 판단하므로 주입하지 않으며, 정규식 발견은 커밋 게이트
 * (run-ledger verifyRequired)를 태우지 않는다 — 그 게이트는 결정론적
 * 검증 흐름(vibe.verify) 전용이다.
 */
import { getToolsBaseUrl, PROJECT_DIR, readProjectConfig } from './utils.js';
import { readFileSync } from 'fs';
import path from 'path';
import { buildCliCtx, isDirectRun } from './lib/hook-context.js';

const BASE_URL = getToolsBaseUrl();

// P1 이슈 판단 기준: .ts/.tsx 파일에서만 적용
const P1_DETECTORS = [
  // `: any` — 타입 어노테이션
  /:\s*any\b/,
  // `as any` — 타입 캐스트
  /\bas\s+any\b/,
  // `<any>` — 제네릭 any (단, JSX 태그 제외 목적으로 뒤에 공백/쉼표/> 허용)
  /<any[\s,>]/,
  // @ts-ignore
  /@ts-ignore\b/,
];

const TS_EXT_RE = /\.(ts|tsx)$/;
const CODE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

// console.log 기본 허용 경로 (glob 패턴 → 정규식으로 변환)
const DEFAULT_CONSOLE_ALLOW_GLOBS = [
  'hooks/scripts/**',
  'scripts/**',
  '**/cli/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**',
];

/**
 * 경량 glob → RegExp 변환 (scope-guard와 동일 알고리즘, 독립 복사본).
 * @param {string} glob
 * @returns {RegExp}
 */
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

/**
 * .vibe/config.json의 qualityCheck.consoleAllow 글로브 목록 로드.
 * 기본 글로브와 병합하여 반환.
 * @returns {RegExp[]}
 */
function loadConsoleAllowPatterns() {
  try {
    const cfg = readProjectConfig();
    const extra = cfg?.qualityCheck?.consoleAllow;
    const globs = Array.isArray(extra)
      ? [...DEFAULT_CONSOLE_ALLOW_GLOBS, ...extra]
      : DEFAULT_CONSOLE_ALLOW_GLOBS;
    return globs.map(g => globToRegExp(g));
  } catch {
    return DEFAULT_CONSOLE_ALLOW_GLOBS.map(g => globToRegExp(g));
  }
}

/**
 * 파일 경로가 console.log 허용 경로인지 판단.
 * @param {string} filePath - 절대 또는 프로젝트 상대 경로
 * @returns {boolean}
 */
function isConsoleAllowed(filePath) {
  try {
    const rel = path.relative(PROJECT_DIR, path.resolve(filePath)).replace(/\\/g, '/');
    const patterns = loadConsoleAllowPatterns();
    return patterns.some(re => re.test(rel));
  } catch {
    return false;
  }
}

/**
 * hook input에서 수정된 파일 경로 추출.
 * @param {object} ctx
 * @returns {string[]}
 */
function getModifiedFiles(ctx) {
  try {
    const parsed = ctx.payload || (ctx.hookInput ? JSON.parse(ctx.hookInput) : null);
    const filePath = parsed?.tool_input?.file_path || parsed?.tool_input?.path;
    return filePath ? [filePath] : [];
  } catch {
    // ignore
  }
  return [];
}

/**
 * 파일 확장자/경로로 관찰 타입 분류
 * @param {string[]} files
 * @returns {{ type: string, title: string }}
 */
function classifyObservation(files) {
  const hasTest = files.some(f => /\.(test|spec)\.[jt]sx?$/.test(f) || /\/__tests__\//.test(f));
  const hasConfig = files.some(f => /\.(json|ya?ml|toml|env|config)/.test(f));

  if (hasTest) return { type: 'feature', title: 'Test file updated' };
  if (hasConfig) return { type: 'refactor', title: 'Configuration updated' };
  return { type: 'feature', title: 'Code modified' };
}

/**
 * P1: any 타입 탐지 — .ts/.tsx 전용, 단어 경계 기반.
 * @param {string[]} lines
 * @returns {Array<{ line: number, match: string, severity: 'P1' }>}
 */
function detectAnyType(lines) {
  const findings = [];
  lines.forEach((line, i) => {
    for (const re of P1_DETECTORS) {
      if (re.test(line)) {
        findings.push({
          line: i + 1,
          match: line.trim(),
          severity: 'P1',
          suggestion: "Replace with: unknown + type guard pattern: if (typeof x === 'string') { ... }",
        });
        break; // 한 줄에 여러 패턴이 있어도 중복 발견 방지
      }
    }
  });
  return findings;
}

/**
 * P1: console.log 탐지 — 허용 경로가 아닌 곳의 src/ 코드.
 * @param {string[]} lines
 * @param {string} filePath
 * @returns {Array<{ line: number, match: string, severity: 'P1' }>}
 */
function detectConsoleLogs(lines, filePath) {
  if (isConsoleAllowed(filePath)) return [];
  const findings = [];
  lines.forEach((line, i) => {
    if (/console\.log\(/.test(line)) {
      findings.push({
        line: i + 1,
        match: line.trim(),
        severity: 'P1',
        suggestion: 'Remove or replace with debugLog utility',
      });
    }
  });
  return findings;
}

/**
 * 하드룰 탐지기 실행. findings 배열 반환.
 * @param {string} filePath
 * @returns {{ p1: string[] }}
 */
function runDetectors(filePath) {
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return { p1: [] };
  }

  const lines = content.split('\n');
  const isTs = TS_EXT_RE.test(filePath);

  const p1Findings = [];

  // P1: any 탐지 — TS 파일만
  if (isTs) {
    const anyHits = detectAnyType(lines).slice(0, 2);
    for (const f of anyHits) {
      p1Findings.push(`P1 any-type line ${f.line}: ${f.match.substring(0, 60)}`);
    }
  }

  // P1: console.log — 허용 경로 제외
  const consoleHits = detectConsoleLogs(lines, filePath).slice(0, 2);
  for (const f of consoleHits) {
    p1Findings.push(`P1 console.log line ${f.line}: ${f.match.substring(0, 60)}`);
  }

  return { p1: p1Findings };
}

/**
 * in-process 진입점 — 품질 검사 + 관찰 캡처.
 * findings 배열을 반환한다 (디스패처가 수집해 additionalContext에 주입).
 * @param {{ payload: object|null, hookInput: string|null }} ctx
 * @returns {Promise<{ exitCode: number, findings: string[] }>}
 */
export async function run(ctx) {
  const findings = [];
  const files = getModifiedFiles(ctx);
  if (files.length === 0) return { exitCode: 0, findings };

  // 1. 하드룰 탐지기 실행 (changed file only) — additionalContext 주입만.
  //    커밋 게이트(verifyRequired)는 태우지 않는다: 정규식 오탐 하나가
  //    auto-commit을 차단하는 결합은 제거됨 (harness-review-2026-07-01).
  try {
    const { p1 } = runDetectors(files[0]);
    for (const msg of p1) findings.push(msg);
  } catch {
    // 탐지기 실패 → fail-open, 계속 진행
  }

  // 2. validateCodeQuality 호출 (P1/P2 필터)
  try {
    const module = await import(`${BASE_URL}convention/index.js`);
    const result = await module.validateCodeQuality({
      targetPath: files[0],
      projectPath: PROJECT_DIR,
    });
    const text = result.content[0].text;
    const critical = text.split('\n').filter(l => /\b(error|critical|P1|P2)\b/i.test(l)).slice(0, 3);
    for (const line of critical) findings.push(`[CODE CHECK] ${line}`);
  } catch {
    // Silently continue on check failure
  }

  // 3. 관찰 자동 캡처
  try {
    const memModule = await import(`${BASE_URL}memory/index.js`);
    const { type, title } = classifyObservation(files);

    await memModule.addObservation({
      type,
      title: `${title}: ${files.map(f => f.split(/[\\/]/).pop()).join(', ')}`,
      filesModified: files,
      projectPath: PROJECT_DIR,
    });
  } catch {
    // 관찰 캡처 실패해도 무시
  }

  return { exitCode: 0, findings };
}

// standalone CLI 모드 (직접 실행 시 — 디스패처 없이)
if (isDirectRun(import.meta.url)) {
  process.on('uncaughtException', () => {});
  process.on('unhandledRejection', () => {});
  const { exitCode, findings } = await run(buildCliCtx());
  if (findings.length > 0) process.stdout.write(findings.join('\n') + '\n');
  process.exit(exitCode);
}
