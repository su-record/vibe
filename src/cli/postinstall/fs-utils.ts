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
 * 스킬 복사 (이미 존재하는 파일은 건너뜀 - 유저 수정 보존)
 */
export function copySkillsIfMissing(src: string, dest: string): void {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copySkillsIfMissing(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      // 파일이 없을 때만 복사
      fs.copyFileSync(srcPath, destPath);
    }
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
    copySkillsIfMissing(srcPath, destPath);
  }
}
