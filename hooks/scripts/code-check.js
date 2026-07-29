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
import { getToolsBaseUrl, PROJECT_DIR } from './utils.js';
import { readFileSync } from 'fs';
import { buildCliCtx, isDirectRun } from './lib/hook-context.js';
import { CODE_EXT_RE, shouldCheckConsole } from './lib/console-allow.js';

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

/**
 * hook ctx에서 수정된 파일 경로 추출.
 * @param {object} ctx
 * @returns {string[]}
 */
function getModifiedFiles(ctx) {
  return ctx.filePath ? [ctx.filePath] : [];
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
 * 백슬래시로 이스케이프되지 않은 첫 token 위치. 없으면 -1.
 * 템플릿 리터럴 안의 \` 를 종료 백틱으로 오인하지 않기 위해 필요하다.
 * @param {string} str
 * @param {string} token
 * @returns {number}
 */
function findUnescaped(str, token) {
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\') { i++; continue; }
    if (str.startsWith(token, i)) return i;
  }
  return -1;
}

/**
 * 한 줄에서 코드가 아닌 구간(주석·문자열·템플릿 리터럴)을 지운다.
 * 여러 줄에 걸친 블록 주석·템플릿 리터럴을 잇기 위해 state를 받고 갱신해 돌려준다.
 * @param {string} line
 * @param {{ inBlock: boolean, inTemplate: boolean }} state - 제자리 갱신
 * @returns {string} 코드 구간만 남은 문자열
 */
function stripNonCodeLine(line, state) {
  let rest = line;
  let code = '';
  while (rest.length > 0) {
    if (state.inBlock || state.inTemplate) {
      const closer = state.inBlock ? '*/' : '`';
      const end = findUnescaped(rest, closer);
      if (end === -1) break;
      if (state.inBlock) state.inBlock = false;
      else state.inTemplate = false;
      rest = rest.slice(end + closer.length);
      continue;
    }
    const opener = rest.match(/\/\*|\/\/|`|'|"/);
    if (!opener) return code + rest;
    code += rest.slice(0, opener.index);
    const token = opener[0];
    rest = rest.slice(opener.index + token.length);
    if (token === '//') break;
    if (token === '/*') { state.inBlock = true; continue; }
    if (token === '`') { state.inTemplate = true; continue; }
    const close = findUnescaped(rest, token); // 홑/겹따옴표는 줄을 넘지 않는다
    rest = close === -1 ? '' : rest.slice(close + 1);
  }
  return code;
}

/**
 * P1: any 타입 탐지 — .ts/.tsx 전용, 단어 경계 기반.
 *
 * 주석·문자열·템플릿 리터럴은 제외한다: `any` 를 **금지하는** 문서 문장이
 * 그 자체로 P1 이 되면, 고칠 수도 없는 경고가 그 파일을 편집할 때마다
 * 주입돼 게이트 신뢰도가 떨어진다 (detectConsoleLogs의 확장자 게이트와 같은 이유).
 *
 * @param {string[]} lines
 * @returns {Array<{ line: number, match: string, severity: 'P1' }>}
 */
function detectAnyType(lines) {
  const findings = [];
  const state = { inBlock: false, inTemplate: false };
  lines.forEach((line, i) => {
    const code = stripNonCodeLine(line, state);
    for (const re of P1_DETECTORS) {
      if (re.test(code)) {
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
 *
 * 두 겹의 게이트를 쓴다:
 *  1. 확장자 — 마크다운·JSON·텍스트에 인용된 `console.log(` 는 커밋되면 안 되는
 *     디버그 코드가 아니라 문서상의 예시다. 이게 없으면 SKILL.md 안의 스니펫이
 *     매 편집마다 P1 으로 주입된다.
 *  2. 코드 구간 — 코드 파일 **안에서도** JSDoc 예시와 사용자에게 출력할 마크다운
 *     템플릿 리터럴에 `console.log(` 가 등장한다. 원본 라인을 그대로 검사하면
 *     그것들이 전부 P1 이 되어, 고칠 수 없는 경고가 반복되고 게이트 신뢰도가
 *     떨어진다 — detectAnyType 이 stripNonCodeLine 을 쓰는 것과 같은 이유다.
 *     (2026-07-28 감사: 실측 9건 중 7건이 이 오탐이었다)
 *
 * @param {string[]} lines
 * @param {string} filePath
 * @returns {Array<{ line: number, match: string, severity: 'P1' }>}
 */
function detectConsoleLogs(lines, filePath) {
  if (!shouldCheckConsole(filePath)) return [];
  const findings = [];
  const state = { inBlock: false, inTemplate: false };
  lines.forEach((line, i) => {
    const code = stripNonCodeLine(line, state);
    if (/console\.log\(/.test(code)) {
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
 * @param {{ filePath: string }} ctx
 * @returns {Promise<{ exitCode: number, findings: string[] }>}
 */
export async function run(ctx) {
  const findings = [];
  const files = getModifiedFiles(ctx);
  if (files.length === 0) return { exitCode: 0, findings };

  // 1. 하드룰 탐지기 실행 (changed file only, regex only — 동적 import 없음) —
  //    additionalContext 주입만. 커밋 게이트(verifyRequired)는 태우지 않는다:
  //    정규식 오탐 하나가 auto-commit을 차단하는 결합은 제거됨
  //    (harness-review-2026-07-01).
  try {
    const { p1 } = runDetectors(files[0]);
    for (const msg of p1) findings.push(msg);
  } catch {
    // 탐지기 실패 → fail-open, 계속 진행
  }

  // validateCodeQuality가 처리하지 않는 확장자는 무거운 동적 import
  // (convention/index.js·memory/index.js — 모듈 그래프 + SQLite 오픈) 전에 조기 반환.
  if (!CODE_EXT_RE.test(files[0])) return { exitCode: 0, findings };

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

  // 3. 관찰 자동 캡처 — 위반(findings)이 실제로 있을 때만 SQLite 기록 (clean edit은 write 생략)
  if (findings.length > 0) {
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
