/**
 * GlobalInstaller - 전역 패키지 및 자산 설치
 * setup.ts에서 추출
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { log, ensureDir, copyDirRecursive, removeDirRecursive, getPackageJson } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 전역 vibe 패키지 설치 경로:
 * - Windows: %APPDATA%\vibe\ (예: C:\Users\xxx\AppData\Roaming\vibe\)
 * - macOS/Linux: ~/.config/vibe/
 */
export function getVibeConfigDir(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe');
  }
  return path.join(os.homedir(), '.config', 'vibe');
}

/**
 * 전역 vibe 패키지 설치
 */
export function installGlobalVibePackage(isUpdate = false): void {
  const globalVibeDir = getVibeConfigDir();
  const nodeModulesDir = path.join(globalVibeDir, 'node_modules');
  const vibePackageDir = path.join(nodeModulesDir, '@su-record', 'vibe');
  const packageJson = getPackageJson();
  const currentVersion = packageJson.version;

  // 이미 설치되어 있는지 확인
  const installedPackageJson = path.join(vibePackageDir, 'package.json');
  if (fs.existsSync(installedPackageJson)) {
    try {
      const installed = JSON.parse(fs.readFileSync(installedPackageJson, 'utf-8'));
      if (installed.version === currentVersion && !isUpdate) {
        return;
      }
    } catch { /* ignore: reinstall if can't read */ }
  }

  // 디렉토리 생성
  ensureDir(globalVibeDir);
  ensureDir(nodeModulesDir);
  ensureDir(path.join(nodeModulesDir, '@su-record'));

  // 기존 설치 제거
  if (fs.existsSync(vibePackageDir)) {
    removeDirRecursive(vibePackageDir);
  }

  // 1. 패키지 복사 시도 (실패해도 훅은 복사)
  try {
    const globalNpmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const globalNpmVibeDir = path.join(globalNpmRoot, '@su-record', 'vibe');

    if (fs.existsSync(globalNpmVibeDir)) {
      copyDirRecursive(globalNpmVibeDir, vibePackageDir);
    } else {
      execSync(`npm install @su-record/vibe@${currentVersion} --prefix "${globalVibeDir}" --no-save`, {
        stdio: 'pipe',
      });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    log('   ⚠️  Package install failed: ' + message + '\n');
  }

  // 2. 훅 스크립트 복사 (패키지 복사 실패해도 실행)
  copyHookScripts(vibePackageDir, globalVibeDir);
}

/**
 * 훅 스크립트 복사
 */
function copyHookScripts(vibePackageDir: string, globalVibeDir: string): void {
  try {
    const packageRoot = path.resolve(__dirname, '..', '..', '..');
    const installedHooksSource = path.join(vibePackageDir, 'hooks', 'scripts');
    const localHooksSource = path.join(packageRoot, 'hooks', 'scripts');
    const hooksScriptsSource = fs.existsSync(installedHooksSource) ? installedHooksSource : localHooksSource;
    const hooksScriptsTarget = path.join(globalVibeDir, 'hooks', 'scripts');

    if (fs.existsSync(hooksScriptsSource)) {
      ensureDir(path.join(globalVibeDir, 'hooks'));
      if (fs.existsSync(hooksScriptsTarget)) {
        removeDirRecursive(hooksScriptsTarget);
      }
      copyDirRecursive(hooksScriptsSource, hooksScriptsTarget);
    } else {
      log('   ⚠️  Hook scripts source not found: ' + hooksScriptsSource + '\n');
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    log('   ⚠️  Hook scripts copy failed: ' + message + '\n');
  }
}

/**
 * ~/.claude/ 전역 assets 설치 (commands, agents, skills)
 */
export function installGlobalAssets(isUpdate = false): void {
  const globalClaudeDir = path.join(os.homedir(), '.claude');
  ensureDir(globalClaudeDir);

  const packageRoot = path.resolve(__dirname, '..', '..', '..');

  // commands
  const globalCommandsDir = path.join(globalClaudeDir, 'commands');
  ensureDir(globalCommandsDir);
  const commandsSource = path.join(packageRoot, 'commands');
  copyDirRecursive(commandsSource, globalCommandsDir);

  // agents
  const globalAgentsDir = path.join(globalClaudeDir, 'agents');
  ensureDir(globalAgentsDir);
  const agentsSource = path.join(packageRoot, 'agents');
  copyDirRecursive(agentsSource, globalAgentsDir);

  // skills
  const globalSkillsDir = path.join(globalClaudeDir, 'skills');
  ensureDir(globalSkillsDir);
  const skillsSource = path.join(packageRoot, 'skills');
  if (fs.existsSync(skillsSource)) {
    copyDirRecursive(skillsSource, globalSkillsDir);
  }
}

/**
 * MCP 서버 정리 (no-op)
 * vibe는 더 이상 MCP를 사용하지 않음
 */
export function registerMcpServers(_isUpdate = false): void {
  // no-op: vibe는 MCP를 사용하지 않음
}
