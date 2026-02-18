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
 * 패키지 하위 경로의 file:// URL 반환 (크로스 플랫폼)
 * 우선순위: 로컬 빌드 → ~/.vibe/ → 전역 npm
 */
function getPackageUrl(subpath, probeFile) {
  const localDist = path.join(VIBE_PATH, subpath);
  const vibePackage = path.join(VIBE_HOME_DIR, 'node_modules', '@su-record', 'vibe', subpath);
  const globalPackage = path.join(getGlobalNpmPath(), '@su-record', 'vibe', subpath);

  if (fs.existsSync(path.join(localDist, probeFile))) return toFileUrl(localDist);
  if (fs.existsSync(path.join(vibePackage, probeFile))) return toFileUrl(vibePackage);
  return toFileUrl(globalPackage);
}

export function getToolsBaseUrl() {
  return getPackageUrl(path.join('dist', 'tools'), 'index.js');
}

export function getLibBaseUrl() {
  return getPackageUrl(path.join('dist', 'infra', 'lib'), 'gpt-api.js');
}
