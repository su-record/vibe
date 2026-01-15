/**
 * CLI 유틸리티 함수
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 전역 옵션 (index.ts에서 설정)
let silentMode = false;

export function setSilentMode(silent: boolean): void {
  silentMode = silent;
}

/**
 * 로그 출력 (silent 모드 지원)
 */
export function log(message: string): void {
  if (!silentMode) {
    console.log(message);
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

/**
 * 디렉토리 내용 복사 (1단계만)
 */
export function copyDirContents(sourceDir: string, targetDir: string): void {
  if (fs.existsSync(sourceDir)) {
    fs.readdirSync(sourceDir).forEach(file => {
      fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
    });
  }
}

/**
 * 디렉토리 재귀 복사
 */
export function copyDirRecursive(sourceDir: string, targetDir: string): void {
  if (!fs.existsSync(sourceDir)) return;

  ensureDir(targetDir);

  fs.readdirSync(sourceDir).forEach(item => {
    const sourcePath = path.join(sourceDir, item);
    const targetPath = path.join(targetDir, item);

    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

/**
 * 디렉토리 재귀 삭제
 */
export function removeDirRecursive(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return;

  fs.readdirSync(dirPath).forEach(item => {
    const itemPath = path.join(dirPath, item);
    if (fs.statSync(itemPath).isDirectory()) {
      removeDirRecursive(itemPath);
    } else {
      fs.unlinkSync(itemPath);
    }
  });
  fs.rmdirSync(dirPath);
}

/**
 * package.json 읽기
 */
export function getPackageJson(): { version: string } {
  try {
    const pkgPath = path.join(__dirname, '../../package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch { /* ignore: optional operation */
    return { version: '0.0.0' };
  }
}

/**
 * 버전 비교 (semver)
 * @returns 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(Number);
  const partsB = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

/**
 * __dirname 반환 (ESM 호환)
 */
export function getCliDir(): string {
  return __dirname;
}
