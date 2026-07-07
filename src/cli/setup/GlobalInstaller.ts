/**
 * GlobalInstaller - 전역 패키지 및 자산 설치
 */

import path from 'path';
import fs from 'fs';
import { ensureDir } from '../utils.js';
import { getGlobalConfigDir } from '../../infra/lib/llm/auth/ConfigManager.js';

/**
 * 전역 vibe 패키지 설치 경로 (getCoreConfigDir = getGlobalConfigDir alias)
 */
export const getCoreConfigDir = getGlobalConfigDir;

function readPackageJsonObject(packageJsonPath: string): Record<string, unknown> {
  if (!fs.existsSync(packageJsonPath)) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

export function writeHookPackageJson(globalCoreDir: string): void {
  ensureDir(globalCoreDir);
  const packageJsonPath = path.join(globalCoreDir, 'package.json');
  const packageJson = readPackageJsonObject(packageJsonPath);
  packageJson.type = 'module';
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}
