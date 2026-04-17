/**
 * 훅 스크립트 공통 유틸리티
 * 크로스 플랫폼 지원 (Windows/macOS/Linux)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync } from 'child_process';
import os from 'os';

// 플랫폼 감지
const IS_WINDOWS = os.platform() === 'win32';

// 스크립트 위치에서 VIBE_PATH 자동 감지
// hooks/scripts/utils.js → hooks → VIBE_PATH
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DETECTED_VIBE_PATH = path.resolve(__dirname, '..', '..');

export const VIBE_PATH = process.env.VIBE_PATH || DETECTED_VIBE_PATH;
export const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || '.';

// ~/.vibe/ 디렉토리 경로
const VIBE_HOME_DIR = path.join(os.homedir(), '.vibe');

/**
 * ~/.vibe/config.json 읽기
 * @returns {object} 파싱된 config 또는 빈 객체
 */
export function readVibeConfig() {
  const configPath = path.join(VIBE_HOME_DIR, 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

/**
 * 프로젝트 설정(.claude/vibe/config.json) 읽기
 * @returns {object} 파싱된 config 또는 빈 객체
 */
export function readProjectConfig() {
  const configPath = path.join(PROJECT_DIR, '.claude', 'vibe', 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

/**
 * Deep merge: source의 값이 target을 덮어씀 (배열은 교체)
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    if (srcVal === undefined) continue;
    const tgtVal = target[key];
    if (
      tgtVal && typeof tgtVal === 'object' && !Array.isArray(tgtVal) &&
      srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)
    ) {
      result[key] = deepMerge(tgtVal, srcVal);
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}

/**
 * 다중 계층 설정 병합: 글로벌 + 프로젝트
 * 우선순위: 프로젝트 > 글로벌 (credentials는 글로벌 전용)
 * @returns {object} 병합된 config
 */
export function resolveVibeConfig() {
  const global = readVibeConfig();
  const project = readProjectConfig();
  if (Object.keys(project).length === 0) return global;
  const { credentials: _ignored, ...projectWithoutCreds } = project;
  return deepMerge(global, projectWithoutCreds);
}

/**
 * 파일 시스템 경로를 file:// URL로 변환 (크로스 플랫폼)
 * - macOS/Linux: /Users/grove/... → file:///Users/grove/...
 * - Windows: C:\Users\grove\... → file:///C:/Users/grove/...
 */
function toFileUrl(fsPath) {
  // path.resolve로 정규화된 절대 경로 생성
  const absolutePath = path.resolve(fsPath);
  // Node.js 내장 pathToFileURL 사용 (크로스 플랫폼 안전)
  const url = pathToFileURL(absolutePath).href;
  // 디렉토리 URL은 trailing slash 추가
  return url.endsWith('/') ? url : url + '/';
}

// 전역 npm 경로 캐시
let _globalNpmPath = null;
function getGlobalNpmPath() {
  if (_globalNpmPath === null) {
    try {
      _globalNpmPath = execSync('npm root -g', { encoding: 'utf8' }).trim();
    } catch {
      // 폴백: 플랫폼별 기본 경로
      if (IS_WINDOWS) {
        // Windows: %APPDATA%\npm\node_modules 또는 %LOCALAPPDATA%\npm\node_modules
        const appData = process.env.APPDATA || process.env.LOCALAPPDATA || '';
        _globalNpmPath = path.join(appData, 'npm', 'node_modules');
      } else {
        // macOS/Linux: /usr/local/lib/node_modules 또는 ~/.npm-global/lib/node_modules
        const homeDir = os.homedir();
        const defaultPaths = [
          '/usr/local/lib/node_modules',
          path.join(homeDir, '.npm-global', 'lib', 'node_modules'),
          path.join(homeDir, '.nvm', 'versions', 'node', process.version, 'lib', 'node_modules'),
        ];
        _globalNpmPath = defaultPaths.find(p => fs.existsSync(p)) || defaultPaths[0];
      }
    }
  }
  return _globalNpmPath;
}

/**
 * 패키지 루트에 런타임 의존성(node_modules)이 설치되어 있는지 확인
 * dist/ 만 복사되고 node_modules/ 가 없으면 better-sqlite3 등 네이티브 모듈 import 실패
 */
function hasRuntimeDeps(packageRoot) {
  return fs.existsSync(path.join(packageRoot, 'node_modules', 'better-sqlite3'));
}

/**
 * 패키지 하위 경로의 file:// URL 반환 (크로스 플랫폼)
 * 우선순위: 로컬 빌드 → ~/.vibe/ → 전역 npm
 * 각 후보는 probeFile 존재 + 런타임 deps 해석 가능해야 채택 (dist-only 복사본 회피)
 */
function getPackageUrl(subpath, probeFile) {
  const localRoot = VIBE_PATH;
  const vibeRoot = path.join(VIBE_HOME_DIR, 'node_modules', '@su-record', 'vibe');
  const globalRoot = path.join(getGlobalNpmPath(), '@su-record', 'vibe');

  const candidates = [localRoot, vibeRoot, globalRoot];
  for (const root of candidates) {
    const target = path.join(root, subpath);
    if (fs.existsSync(path.join(target, probeFile)) && hasRuntimeDeps(root)) {
      return toFileUrl(target);
    }
  }
  return toFileUrl(path.join(globalRoot, subpath));
}

export function getToolsBaseUrl() {
  return getPackageUrl(path.join('dist', 'tools'), 'index.js');
}

export function getLibBaseUrl() {
  return getPackageUrl(path.join('dist', 'infra', 'lib'), 'constants.js');
}

// ─── Hook Trace Logging ───

const HOOK_TRACE_PATH = path.join(VIBE_HOME_DIR, 'hook-traces.jsonl');
const MAX_TRACE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB rotation

/**
 * Guard/Hook 결정 사항을 JSONL로 로깅
 * evolution GuardAnalyzer가 이 로그를 분석해 하네스 자기 개선에 활용
 *
 * @param {string} hookName - 훅 이름 (e.g., 'sentinel-guard', 'pre-tool-guard')
 * @param {string} toolName - 대상 도구 (e.g., 'Bash', 'Write')
 * @param {'allow'|'block'|'warn'} decision - 판정 결과
 * @param {string} reason - 판정 사유
 */
export function logHookDecision(hookName, toolName, decision, reason) {
  try {
    // 로그 로테이션: 5MB 초과 시 이전 파일 교체
    if (fs.existsSync(HOOK_TRACE_PATH)) {
      const stat = fs.statSync(HOOK_TRACE_PATH);
      if (stat.size > MAX_TRACE_SIZE_BYTES) {
        const rotated = HOOK_TRACE_PATH + '.prev';
        try { fs.unlinkSync(rotated); } catch { /* ignore */ }
        fs.renameSync(HOOK_TRACE_PATH, rotated);
      }
    }

    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      hook: hookName,
      tool: toolName,
      decision,
      reason,
      project: PROJECT_DIR,
    });
    fs.appendFileSync(HOOK_TRACE_PATH, entry + '\n');
  } catch { /* 트레이스 실패가 훅 실행을 방해해선 안 됨 */ }
}

// ─── LLM Cost Tracking ───

const LLM_COST_PATH = path.join(VIBE_HOME_DIR, 'llm-costs.jsonl');
const MAX_COST_SIZE_BYTES = 5 * 1024 * 1024; // 5MB rotation

// 1K 토큰당 USD (추정치, 2026-04 기준)
const COST_PER_1K_TOKENS = {
  'gpt-5.4': { input: 0.005, output: 0.015 },
  'gpt-5.3-codex': { input: 0.003, output: 0.010 },
  'gpt-5.3-codex-spark': { input: 0.001, output: 0.005 },
  'gemini-3.1-pro-preview': { input: 0.00125, output: 0.005 },
};
const DEFAULT_COST = { input: 0.003, output: 0.010 };

/**
 * LLM 호출 비용을 JSONL로 로깅
 *
 * @param {string} provider - 프로바이더 (gpt, gemini)
 * @param {string} model - 모델명
 * @param {number} inputLen - 입력 문자 수
 * @param {number} outputLen - 출력 문자 수
 * @param {number} durationMs - 호출 소요 시간
 * @param {boolean} cached - 캐시 히트 여부
 */
export function logLlmCost(provider, model, inputLen, outputLen, durationMs, cached) {
  try {
    if (fs.existsSync(LLM_COST_PATH)) {
      const stat = fs.statSync(LLM_COST_PATH);
      if (stat.size > MAX_COST_SIZE_BYTES) {
        const rotated = LLM_COST_PATH + '.prev';
        try { fs.unlinkSync(rotated); } catch { /* ignore */ }
        fs.renameSync(LLM_COST_PATH, rotated);
      }
    }

    // 문자 수 → 토큰 추정 (영어 ~4자/토큰, 한글 ~2자/토큰 평균 3자)
    const inputTokens = Math.ceil(inputLen / 3);
    const outputTokens = Math.ceil(outputLen / 3);
    const rates = COST_PER_1K_TOKENS[model] || DEFAULT_COST;
    const cost = cached ? 0
      : (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;

    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      provider,
      model,
      inputTokens,
      outputTokens,
      cost: Math.round(cost * 1_000_000) / 1_000_000, // 소수점 6자리
      durationMs,
      cached,
      project: PROJECT_DIR,
    });
    fs.appendFileSync(LLM_COST_PATH, entry + '\n');
  } catch { /* 비용 추적 실패가 호출을 방해해선 안 됨 */ }
}
