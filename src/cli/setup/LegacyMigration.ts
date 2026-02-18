/**
 * LegacyMigration - 레거시 마이그레이션 및 정리
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { ensureDir, copyDirRecursive, removeDirRecursive, log } from '../utils.js';

/**
 * .core/ → .claude/vibe/ 마이그레이션
 */
export function migrateLegacyCore(projectRoot: string, coreDir: string): boolean {
  const legacyCoreDir = path.join(projectRoot, '.core');

  if (!fs.existsSync(legacyCoreDir)) return false;

  ensureDir(coreDir);

  try {
    const itemsToMigrate = ['specs', 'features', 'solutions', 'todos', 'memory', 'rules', 'config.json', 'constitution.md'];
    itemsToMigrate.forEach(item => {
      const src = path.join(legacyCoreDir, item);
      const dst = path.join(coreDir, item);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        if (fs.statSync(src).isDirectory()) {
          copyDirRecursive(src, dst);
        } else {
          fs.copyFileSync(src, dst);
        }
      }
    });
    removeDirRecursive(legacyCoreDir);
    return true;
  } catch { /* ignore: optional operation */
    return false;
  }
}

/**
 * 레거시 파일/폴더 정리
 */
export function cleanupLegacy(projectRoot: string, claudeDir: string): void {
  // .agent/rules/ 정리
  const oldRulesDir = path.join(projectRoot, '.agent/rules');
  const oldAgentDir = path.join(projectRoot, '.agent');
  if (fs.existsSync(oldRulesDir)) {
    removeDirRecursive(oldRulesDir);
    if (fs.existsSync(oldAgentDir) && fs.readdirSync(oldAgentDir).length === 0) {
      fs.rmdirSync(oldAgentDir);
    }
  }

  // 레거시 커맨드 파일 정리
  const commandsDir = path.join(claudeDir, 'commands');
  if (fs.existsSync(commandsDir)) {
    const legacyCommands = [
      'core.analyze.md', 'core.compound.md', 'core.continue.md',
      'core.diagram.md', 'core.e2e.md', 'core.reason.md',
      'core.setup.md', 'core.ui.md'
    ];
    legacyCommands.forEach(cmd => {
      const cmdPath = path.join(commandsDir, cmd);
      if (fs.existsSync(cmdPath)) {
        fs.unlinkSync(cmdPath);
      }
    });
  }

  // 레거시 에이전트 파일 정리
  const agentsDir = path.join(claudeDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    const legacyAgents = ['reviewer.md', 'analyzer.md', 'reasoner.md'];
    legacyAgents.forEach(agent => {
      const agentPath = path.join(agentsDir, agent);
      if (fs.existsSync(agentPath)) {
        fs.unlinkSync(agentPath);
      }
    });
  }

  // 프로젝트 로컬 settings.json 제거
  const localSettingsPath = path.join(claudeDir, 'settings.json');
  if (fs.existsSync(localSettingsPath)) {
    try {
      fs.unlinkSync(localSettingsPath);
    } catch { /* ignore: optional operation */ }
  }
}

/**
 * 패키지 소스 디렉토리의 파일 목록을 재귀적으로 수집 (상대 경로)
 */
function collectFiles(dir: string, baseDir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir));
    } else {
      files.push(path.relative(baseDir, fullPath));
    }
  }
  return files;
}

/**
 * core가 설치한 파일만 선별적으로 제거하고, 사용자 커스텀 파일은 보존.
 * 빈 디렉토리는 정리.
 */
function removeCoreOwnedFiles(localDir: string, sourceDir: string): void {
  if (!fs.existsSync(localDir)) return;

  const coreFiles = collectFiles(sourceDir, sourceDir);
  for (const relPath of coreFiles) {
    const targetPath = path.join(localDir, relPath);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  }

  // 빈 하위 디렉토리 정리 (깊은 곳부터)
  cleanEmptyDirs(localDir);
}

/**
 * 빈 디렉토리를 재귀적으로 제거 (리프부터)
 */
function cleanEmptyDirs(dir: string): void {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      cleanEmptyDirs(fullPath);
    }
  }
  if (fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

/**
 * 프로젝트 로컬 설정/자산 제거 (core 소유 파일만 선별 삭제, 사용자 커스텀 파일 보존)
 */
export function removeLocalAssets(claudeDir: string, packageRoot?: string): void {
  // 레거시 settings.json은 무조건 제거
  const localSettingsJson = path.join(claudeDir, 'settings.json');
  if (fs.existsSync(localSettingsJson)) {
    fs.unlinkSync(localSettingsJson);
  }

  if (packageRoot) {
    // 패키지 소스 기준으로 core 소유 파일만 선별 삭제
    const assetDirs = ['commands', 'agents', 'skills'] as const;
    for (const dir of assetDirs) {
      const sourceDir = path.join(packageRoot, dir);
      const localDir = path.join(claudeDir, dir);
      removeCoreOwnedFiles(localDir, sourceDir);
    }
  } else {
    // packageRoot 없으면 레거시 동작 (전체 삭제) — 하위 호환
    const dirs = ['commands', 'agents', 'skills'];
    for (const dir of dirs) {
      const dirPath = path.join(claudeDir, dir);
      if (fs.existsSync(dirPath)) {
        removeDirRecursive(dirPath);
      }
    }
  }
}

/**
 * ~/.claude.json 정리 (로컬 MCP 설정 제거)
 */
export function cleanupClaudeConfig(): void {
  const claudeConfigPath = path.join(os.homedir(), '.claude.json');

  if (!fs.existsSync(claudeConfigPath)) return;

  try {
    const claudeConfig = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf-8'));
    let configModified = false;

    if (claudeConfig.projects) {
      for (const [projectPath, projectConfig] of Object.entries(claudeConfig.projects) as [string, { mcpServers?: Record<string, { args?: string[] }> }][]) {
        if (projectConfig.mcpServers) {
          if (projectConfig.mcpServers.core) {
            const coreArgs = projectConfig.mcpServers.core.args || [];
            const isLocalPath = coreArgs.some((arg: string) =>
              arg.includes('.core/mcp/') || arg.includes('.core\\mcp\\')
            );
            if (isLocalPath) {
              delete projectConfig.mcpServers.core;
              configModified = true;
              log(`   🧹 ${projectPath}: removed local core MCP\n`);
            }
          }
          if (projectConfig.mcpServers['core-gemini']) {
            const geminiArgs = projectConfig.mcpServers['core-gemini'].args || [];
            const isLocalPath = geminiArgs.some((arg: string) =>
              arg.includes('.core/') || arg.includes('.core\\')
            );
            if (isLocalPath) {
              delete projectConfig.mcpServers['core-gemini'];
              configModified = true;
            }
          }
          if (projectConfig.mcpServers.context7) {
            delete projectConfig.mcpServers.context7;
            configModified = true;
          }
        }
      }
    }

    if (configModified) {
      fs.writeFileSync(claudeConfigPath, JSON.stringify(claudeConfig, null, 2));
    }
  } catch { /* ignore: optional operation */ }
}

/**
 * 레거시 mcp/ 폴더 정리
 */
export function cleanupLegacyMcp(coreDir: string): void {
  const oldMcpDir = path.join(coreDir, 'mcp');
  if (fs.existsSync(oldMcpDir)) {
    try {
      removeDirRecursive(oldMcpDir);
    } catch { /* ignore: optional operation */ }
  }
}
