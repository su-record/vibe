/**
 * console.log 탐지의 적용 범위 판단 — code-check.js·post-edit.js 공용 (중복 제거).
 *
 * 두 훅이 같은 검사를 각자 들고 있으면 한쪽의 허용 경로 설계가 다른 쪽 경고에
 * 무력화된다. 범위 규칙은 여기 하나만 둔다.
 */
import path from 'path';
import { PROJECT_DIR, readProjectConfig } from '../utils.js';
import { globToRegExp } from './glob.js';

/**
 * 코드 확장자 — 마크다운·JSON·텍스트에 인용된 `console.log(` 는 커밋되면 안 되는
 * 디버그 코드가 아니라 문서상의 예시다.
 */
export const CODE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

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
export function isConsoleAllowed(filePath) {
  try {
    const rel = path.relative(PROJECT_DIR, path.resolve(filePath)).replace(/\\/g, '/');
    return loadConsoleAllowPatterns().some(re => re.test(rel));
  } catch {
    return false;
  }
}

/**
 * console.log 검사 대상 파일인지 — 코드 확장자이면서 허용 경로가 아닌 경우.
 * @param {string} filePath
 * @returns {boolean}
 */
export function shouldCheckConsole(filePath) {
  return CODE_EXT_RE.test(filePath) && !isConsoleAllowed(filePath);
}
