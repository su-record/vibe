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
 * 로컬 개발 환경 vs 설치된 패키지 환경 자동 감지하여 tools 경로 반환
 * 우선순위: 로컬 빌드 → 전역 npm
 */
export function getToolsBaseUrl() {
  const localDist = path.join(VIBE_PATH, 'dist', 'tools');
  const globalPackage = path.join(getGlobalNpmPath(), '@su-record', 'vibe', 'dist', 'tools');

  // 1. 로컬 빌드된 파일 확인 (개발 환경)
  const localIndex = path.join(localDist, 'index.js');
  if (fs.existsSync(localIndex)) {
    return toFileUrl(localDist);
  }

  // 2. 전역 npm 패키지 (설치된 환경)
  return toFileUrl(globalPackage);
}

/**
 * lib 경로 반환 (gpt-api, gemini-api 등)
 * 우선순위: 로컬 빌드 → 전역 npm
 */
export function getLibBaseUrl() {
  const localDist = path.join(VIBE_PATH, 'dist', 'lib');
  const globalPackage = path.join(getGlobalNpmPath(), '@su-record', 'vibe', 'dist', 'lib');

  // 1. 로컬 빌드된 파일 확인 (개발 환경)
  const localGptApi = path.join(localDist, 'gpt-api.js');
  if (fs.existsSync(localGptApi)) {
    return toFileUrl(localDist);
  }

  // 2. 전역 npm 패키지 (설치된 환경)
  return toFileUrl(globalPackage);
}
