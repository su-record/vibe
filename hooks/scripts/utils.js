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
 * 프로젝트 내 Vibe 에셋 루트 해석.
 *
 * 신규 SSOT: `<project>/.vibe/` — CLI(Claude/Codex)와 무관한 공용 디렉토리.
 * Legacy fallback:
 *   - `<project>/.claude/vibe/`  (Claude Code 프로젝트 초기화 흔적)
 *
 * 해석 규칙 — **읽기**(lookup) 시:
 *   1) `.vibe/` 가 존재하면 그 경로
 *   2) `.claude/vibe/` 가 존재하면 그 경로
 *   3) 아무것도 없으면 기본값 `.vibe/` (생성 대상)
 *
 * **쓰기**(write) 시에는 항상 새 SSOT 인 `.vibe/` 로 수렴시키는 것이 원칙이지만,
 * 기존 프로젝트의 legacy 파일이 있으면 해당 위치에 쓰는 것이 덜 파괴적이다.
 * → `projectVibePath(projectDir)` 는 기본적으로 "존재하는 경로 우선".
 * 새로 생성하려는 파일은 호출자가 존재 여부를 점검해 `.vibe/` 경로를 선택하거나
 * `projectVibePathPreferred(projectDir)` 로 항상 `.vibe/` 를 얻어 쓸 수 있다.
 */
export function projectVibeRoot(projectDir = PROJECT_DIR) {
  try {
    const vibeRoot = path.join(projectDir, '.vibe');
    if (fs.existsSync(vibeRoot)) return vibeRoot;
    const claudeVibe = path.join(projectDir, '.claude', 'vibe');
    if (fs.existsSync(claudeVibe)) return claudeVibe;
  } catch { /* ignore */ }
  return path.join(projectDir, '.vibe');
}

/** `<project>/.vibe/` 를 무조건 반환 (신규 파일 생성용). */
export function projectVibePathPreferred(projectDir = PROJECT_DIR, ...sub) {
  return path.join(projectDir, '.vibe', ...sub);
}

/** 읽기 우선 — 존재하는 legacy 경로를 반환, 없으면 새 `.vibe/`. */
export function projectVibePath(projectDir = PROJECT_DIR, ...sub) {
  return path.join(projectVibeRoot(projectDir), ...sub);
}

/**
 * 프로젝트 메모리 DB 디렉토리 해석.
 * `.vibe/memories/` (신규) → `.claude/memories/` (legacy Claude) → 기본 `.vibe/memories/`
 */
export function projectMemoryDir(projectDir = PROJECT_DIR) {
  try {
    const candidates = [
      path.join(projectDir, '.vibe', 'memories'),
      path.join(projectDir, '.claude', 'memories'),
    ];
    for (const c of candidates) if (fs.existsSync(c)) return c;
  } catch { /* ignore */ }
  return path.join(projectDir, '.vibe', 'memories');
}

// config 캐시 — 훅 스크립트는 단명 프로세스이므로 프로세스 생명주기 내에서
// config 파일이 바뀌지 않는다고 가정한다 (llm-orchestrate처럼 한 프로세스에서
// 3회 이상 읽는 경로의 중복 read+parse 제거).
let _vibeConfigCache = null;
let _projectConfigCache = null;

/**
 * ~/.vibe/config.json 읽기 (프로세스 내 캐시)
 * @returns {object} 파싱된 config 또는 빈 객체
 */
export function readVibeConfig() {
  if (_vibeConfigCache !== null) return _vibeConfigCache;
  const configPath = path.join(VIBE_HOME_DIR, 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      _vibeConfigCache = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return _vibeConfigCache;
    }
  } catch { /* ignore */ }
  _vibeConfigCache = {};
  return _vibeConfigCache;
}

/**
 * 프로젝트 설정(.vibe/config.json) 읽기 — legacy `.claude/vibe/` fallback 포함 (프로세스 내 캐시)
 * @returns {object} 파싱된 config 또는 빈 객체
 */
export function readProjectConfig() {
  if (_projectConfigCache !== null) return _projectConfigCache;
  const configPath = projectVibePath(PROJECT_DIR, 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      _projectConfigCache = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return _projectConfigCache;
    }
  } catch { /* ignore */ }
  _projectConfigCache = {};
  return _projectConfigCache;
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

// 전역 npm 경로 캐시 — L1: 인-프로세스, L2: 파일 캐시 (TTL 24h)
// VIBE_NPM_ROOT_CACHE_FILE 환경 변수로 테스트 시 격리된 경로 주입 가능
const NPM_ROOT_CACHE_FILE = process.env.VIBE_NPM_ROOT_CACHE_FILE ||
  path.join(os.homedir(), '.vibe', 'cache', 'npm-root.json');
const NPM_ROOT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

/** npm root -g 결과를 파일로 캐시 (원자적 쓰기). 실패는 조용히 무시. */
function saveNpmRootCache(npmRoot) {
  try {
    const dir = path.dirname(NPM_ROOT_CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ npmRoot, savedAt: Date.now() });
    const tmp = NPM_ROOT_CACHE_FILE + '.tmp';
    fs.writeFileSync(tmp, payload, { mode: 0o600 });
    fs.renameSync(tmp, NPM_ROOT_CACHE_FILE);
  } catch { /* 캐시 저장 실패는 무시 */ }
}

/** 파일 캐시에서 npm root 읽기. TTL 초과 또는 손상 시 null 반환. */
function loadNpmRootCache() {
  try {
    const raw = fs.readFileSync(NPM_ROOT_CACHE_FILE, 'utf-8');
    const { npmRoot, savedAt } = JSON.parse(raw);
    if (typeof npmRoot === 'string' && typeof savedAt === 'number') {
      if (Date.now() - savedAt < NPM_ROOT_CACHE_TTL_MS) return npmRoot;
    }
  } catch { /* 파일 없음 / 손상 / 권한 → null */ }
  return null;
}

/** npm root -g 플랫폼 폴백 (execSync 실패 시 사용). */
function npmRootFallback() {
  if (IS_WINDOWS) {
    const appData = process.env.APPDATA || process.env.LOCALAPPDATA || '';
    return path.join(appData, 'npm', 'node_modules');
  }
  const homeDir = os.homedir();
  const candidates = [
    '/usr/local/lib/node_modules',
    path.join(homeDir, '.npm-global', 'lib', 'node_modules'),
    path.join(homeDir, '.nvm', 'versions', 'node', process.version, 'lib', 'node_modules'),
  ];
  return candidates.find(p => fs.existsSync(p)) || candidates[0];
}

// L1 인-프로세스 캐시
let _globalNpmPath = null;
export function getGlobalNpmPath() {
  // L1: 인-프로세스 캐시 히트
  if (_globalNpmPath !== null) return _globalNpmPath;

  // L2: 파일 캐시 히트
  const cached = loadNpmRootCache();
  if (cached !== null) {
    _globalNpmPath = cached;
    return _globalNpmPath;
  }

  // L3: execSync 실행 후 파일 캐시에 저장
  try {
    _globalNpmPath = execSync('npm root -g', { encoding: 'utf8' }).trim();
    saveNpmRootCache(_globalNpmPath);
  } catch {
    _globalNpmPath = npmRootFallback();
    // 폴백은 캐시에 저장하지 않음 — 다음 프로세스에서 재시도
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
 *
 * 프로세스 내 메모이제이션: getToolsBaseUrl/getLibBaseUrl/getCliBaseUrl이 한 훅
 * 프로세스에서 각각 호출되면 최악 6회 동기 stat이 반복되므로 결과를 캐싱한다.
 */
const _packageUrlCache = new Map();
function getPackageUrl(subpath, probeFile) {
  const cacheKey = `${subpath}|${probeFile}`;
  const cached = _packageUrlCache.get(cacheKey);
  if (cached) return cached;

  const localRoot = VIBE_PATH;
  const vibeRoot = path.join(VIBE_HOME_DIR, 'node_modules', '@su-record', 'vibe');
  const globalRoot = path.join(getGlobalNpmPath(), '@su-record', 'vibe');

  const candidates = [localRoot, vibeRoot, globalRoot];
  let result = null;
  for (const root of candidates) {
    const target = path.join(root, subpath);
    if (fs.existsSync(path.join(target, probeFile)) && hasRuntimeDeps(root)) {
      result = toFileUrl(target);
      break;
    }
  }
  if (result === null) result = toFileUrl(path.join(globalRoot, subpath));
  _packageUrlCache.set(cacheKey, result);
  return result;
}

export function getToolsBaseUrl() {
  return getPackageUrl(path.join('dist', 'tools'), 'index.js');
}

export function getLibBaseUrl() {
  return getPackageUrl(path.join('dist', 'infra', 'lib'), 'constants.js');
}

export function getCliBaseUrl() {
  return getPackageUrl(path.join('dist', 'cli'), 'index.js');
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
  'gpt-5.5': { input: 0.005, output: 0.030 },
  'gpt-5.5-pro': { input: 0.030, output: 0.180 },
  'gpt-5.3-codex': { input: 0.003, output: 0.010 },
  'gpt-5.3-codex-spark': { input: 0.001, output: 0.005 },
  'gemini-3.1-pro-preview': { input: 0.00125, output: 0.005 },
};
const DEFAULT_COST = { input: 0.003, output: 0.010 };

/**
 * LLM 호출 비용을 JSONL로 로깅
 *
 * @param {string} provider - 프로바이더 (gpt, antigravity)
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
