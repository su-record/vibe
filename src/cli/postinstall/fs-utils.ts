/**
 * 파일시스템 유틸리티
 */

import path from 'path';
import fs from 'fs';
import { getGlobalConfigDir } from '../../infra/lib/llm/auth/ConfigManager.js';

/**
 * 전역 vibe 설정 디렉토리 경로 (getCoreConfigDir = getGlobalConfigDir alias)
 */
export const getCoreConfigDir = getGlobalConfigDir;

/**
 * 디렉토리 내 모든 .md 파일에서 {{VIBE_PATH}} / {{VIBE_PATH_URL}} 템플릿 치환
 * - {{VIBE_PATH}}     → ~/.vibe  (forward slash)
 * - {{VIBE_PATH_URL}} → file:///~/.vibe/
 */
export function replaceTemplatesInDir(dirPath: string): void {
  const corePath = getCoreConfigDir().replace(/\\/g, '/');
  const corePathUrl = 'file:///' + corePath.replace(/^\//, '');

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      replaceTemplatesInDir(fullPath);
    } else if (entry.name.endsWith('.md')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('{{VIBE_PATH_URL}}') || content.includes('{{VIBE_PATH}}')) {
        content = content.replace(/\{\{VIBE_PATH_URL\}\}/g, corePathUrl);
        content = content.replace(/\{\{VIBE_PATH\}\}/g, corePath);
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

/**
 * 디렉토리 생성 (재귀)
 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Directories to skip during recursive copy */
const COPY_SKIP_DIRS = new Set(['node_modules', '.git']);

/**
 * 디렉토리 복사 (재귀, node_modules/.git 제외)
 */
export function copyDirRecursive(src: string, dest: string): void {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (COPY_SKIP_DIRS.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 디렉토리 삭제 (재귀)
 */
export function removeDirRecursive(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 스킬 복사 (항상 덮어쓰기 — 패키지 업데이트 시 최신 버전 반영)
 */
export function copySkillsOverwrite(src: string, dest: string): void {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copySkillsOverwrite(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 레거시 스킬 디렉토리 삭제 (이름 변경된 구 디렉토리 정리)
 */
export function removeLegacySkills(
  skillsDir: string,
  legacyDirs: ReadonlyArray<string>,
): void {
  for (const name of legacyDirs) {
    const dir = path.join(skillsDir, name);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

/**
 * 디렉토리 기반 스킬 모두 정리 — ~/.claude/vibe/skills/ 에 남아있는 {name}/ 디렉토리 제거
 * Claude Code가 ~/.claude/ 재귀 스캔 시 ~/.claude/skills/와 중복 발견되므로 제거 필요
 * flat .md 파일(인라인 스킬)은 유지
 */
export function cleanupDuplicateSkillDirs(skillsDir: string): void {
  if (!fs.existsSync(skillsDir)) return;
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    fs.rmSync(path.join(skillsDir, entry.name), { recursive: true, force: true });
  }
}

/**
 * 스킬 필터링 복사 — 허용 목록에 있는 스킬 디렉토리만 복사
 * @param src - 스킬 소스 디렉토리 (skills/)
 * @param dest - 설치 대상 디렉토리
 * @param allowedSkills - 복사할 스킬 이름 목록
 */
export function copySkillsFiltered(
  src: string,
  dest: string,
  allowedSkills: ReadonlyArray<string>,
): void {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!allowedSkills.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    copySkillsOverwrite(srcPath, destPath);
  }
}
