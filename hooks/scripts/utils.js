/**
 * 훅 스크립트 공통 유틸리티
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// 스크립트 위치에서 VIBE_PATH 자동 감지
// hooks/scripts/utils.js → hooks → VIBE_PATH
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DETECTED_VIBE_PATH = path.resolve(__dirname, '..', '..');

export const VIBE_PATH = process.env.VIBE_PATH || DETECTED_VIBE_PATH;
export const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || '.';

// 전역 npm 경로 캐시
let _globalNpmPath = null;
function getGlobalNpmPath() {
  if (_globalNpmPath === null) {
    try {
      _globalNpmPath = execSync('npm root -g', { encoding: 'utf8' }).trim();
    } catch {
      // Windows 기본 경로
      _globalNpmPath = path.join(process.env.APPDATA || '', 'npm', 'node_modules');
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
    return `file:///${localDist.replace(/\\/g, '/')}/`;
  }

  // 2. 전역 npm 패키지 (설치된 환경)
  return `file:///${globalPackage.replace(/\\/g, '/')}/`;
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
    return `file:///${localDist.replace(/\\/g, '/')}/`;
  }

  // 2. 전역 npm 패키지 (설치된 환경)
  return `file:///${globalPackage.replace(/\\/g, '/')}/`;
}
