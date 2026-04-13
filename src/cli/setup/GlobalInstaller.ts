/**
 * GlobalInstaller - 전역 패키지 및 자산 설치
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { log, ensureDir, copyDirRecursive, removeDirRecursive, getPackageJson } from '../utils.js';
import { getGlobalConfigDir } from '../../infra/lib/llm/auth/ConfigManager.js';
import { handleCaughtError } from '../../infra/lib/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 전역 vibe 패키지 설치 경로 (getCoreConfigDir = getGlobalConfigDir alias)
 */
export const getCoreConfigDir = getGlobalConfigDir;

/**
 * 전역 core 패키지 설치
 */
export function installGlobalCorePackage(isUpdate = false): void {
  const globalCoreDir = getCoreConfigDir();
  const nodeModulesDir = path.join(globalCoreDir, 'node_modules');
  const corePackageDir = path.join(nodeModulesDir, '@su-record', 'vibe');
  const packageJson = getPackageJson();
  const currentVersion = packageJson.version;

  // 이미 설치되어 있는지 확인
  const installedPackageJson = path.join(corePackageDir, 'package.json');
  if (fs.existsSync(installedPackageJson)) {
    try {
      const installed = JSON.parse(fs.readFileSync(installedPackageJson, 'utf-8'));
      if (installed.version === currentVersion && !isUpdate) {
        return;
      }
    } catch (e: unknown) {
      handleCaughtError('ignorable', 'Reading installed package version (will reinstall)', e);
    }
  }

  // 디렉토리 생성
  ensureDir(globalCoreDir);
  ensureDir(nodeModulesDir);
  ensureDir(path.join(nodeModulesDir, '@su-record'));

  // 기존 설치 제거
  if (fs.existsSync(corePackageDir)) {
    removeDirRecursive(corePackageDir);
  }

  // 1. 패키지 복사 시도 (실패해도 훅은 복사)
  try {
    const globalNpmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const globalNpmCoreDir = path.join(globalNpmRoot, '@su-record', 'vibe');

    if (fs.existsSync(globalNpmCoreDir)) {
      copyDirRecursive(globalNpmCoreDir, corePackageDir);
    } else {
      execSync(`npm install @su-record/vibe@${currentVersion} --prefix "${globalCoreDir}" --no-save`, {
        stdio: 'pipe',
      });
    }

    // 런타임 deps가 누락된 경우 (예: 글로벌 복사본이 dist-only) 명시적으로 설치
    // hooks/scripts/utils.js의 resolver가 better-sqlite3 해석 가능성을 확인하므로 필수
    const nestedNodeModules = path.join(corePackageDir, 'node_modules', 'better-sqlite3');
    if (!fs.existsSync(nestedNodeModules)) {
      execSync('npm install --omit=dev --no-save', {
        cwd: corePackageDir,
        stdio: 'pipe',
      });
    }
  } catch (e: unknown) {
    handleCaughtError('recoverable', 'Package install failed', e, log);
  }

  // 2. 훅 스크립트 복사 (패키지 복사 실패해도 실행)
  copyHookScripts(corePackageDir, globalCoreDir);
}

/**
 * 훅 스크립트 복사
 */
function copyHookScripts(corePackageDir: string, globalCoreDir: string): void {
  try {
    const packageRoot = path.resolve(__dirname, '..', '..', '..');
    const installedHooksSource = path.join(corePackageDir, 'hooks', 'scripts');
    const localHooksSource = path.join(packageRoot, 'hooks', 'scripts');
    const hooksScriptsSource = fs.existsSync(installedHooksSource) ? installedHooksSource : localHooksSource;
    const hooksScriptsTarget = path.join(globalCoreDir, 'hooks', 'scripts');

    if (fs.existsSync(hooksScriptsSource)) {
      ensureDir(path.join(globalCoreDir, 'hooks'));
      if (fs.existsSync(hooksScriptsTarget)) {
        removeDirRecursive(hooksScriptsTarget);
      }
      copyDirRecursive(hooksScriptsSource, hooksScriptsTarget);
    } else {
      log('   ⚠️  Hook scripts source not found: ' + hooksScriptsSource + '\n');
    }
  } catch (e: unknown) {
    handleCaughtError('recoverable', 'Hook scripts copy failed', e, log);
  }
}

/**
 * MCP 서버 정리 (no-op)
 * core는 더 이상 MCP를 사용하지 않음
 */
export function registerMcpServers(_isUpdate = false): void {
  // no-op: core는 MCP를 사용하지 않음
}

/**
 * 전역 ~/.claude/settings.json에서 hooks 정리
 * core는 이제 프로젝트 레벨 (.claude/settings.local.json)에서 훅을 관리하므로
 * 전역 설정의 hooks는 제거해야 함 (레거시 정리)
 */
export function cleanupGlobalSettingsHooks(): void {
  const globalClaudeDir = path.join(os.homedir(), '.claude');
  const globalSettingsPath = path.join(globalClaudeDir, 'settings.json');

  if (!fs.existsSync(globalSettingsPath)) {
    return;
  }

  try {
    const content = fs.readFileSync(globalSettingsPath, 'utf-8');
    const settings = JSON.parse(content);

    // hooks가 있으면 제거
    if (settings.hooks) {
      delete settings.hooks;
      fs.writeFileSync(globalSettingsPath, JSON.stringify(settings, null, 2) + '\n');
      log('   ✓ Cleaned up legacy hooks from global settings\n');
    }
  } catch (e: unknown) {
    handleCaughtError('recoverable', 'Failed to cleanup global settings hooks', e, log);
  }
}
