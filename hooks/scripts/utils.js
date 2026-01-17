/**
 * 훅 스크립트 공통 유틸리티
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 스크립트 위치에서 VIBE_PATH 자동 감지
// hooks/scripts/utils.js → hooks → VIBE_PATH
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DETECTED_VIBE_PATH = path.resolve(__dirname, '..', '..');

export const VIBE_PATH = process.env.VIBE_PATH || DETECTED_VIBE_PATH;
export const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || '.';

/**
 * 로컬 개발 환경 vs 설치된 패키지 환경 자동 감지하여 tools 경로 반환
 */
export function getToolsBaseUrl() {
  const localDist = path.join(VIBE_PATH, 'dist', 'tools');
  const packageDist = path.join(VIBE_PATH, 'node_modules', '@su-record', 'vibe', 'dist', 'tools');

  if (fs.existsSync(localDist)) {
    return `file:///${localDist.replace(/\\/g, '/')}/`;
  }
  return `file:///${packageDist.replace(/\\/g, '/')}/`;
}

/**
 * lib 경로 반환 (gpt-api, gemini-api 등)
 */
export function getLibBaseUrl() {
  const localDist = path.join(VIBE_PATH, 'dist', 'lib');
  const packageDist = path.join(VIBE_PATH, 'node_modules', '@su-record', 'vibe', 'dist', 'lib');

  if (fs.existsSync(localDist)) {
    return `file:///${localDist.replace(/\\/g, '/')}/`;
  }
  return `file:///${packageDist.replace(/\\/g, '/')}/`;
}
