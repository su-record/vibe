/**
 * LegacyMigration - 레거시 마이그레이션 및 정리
 * setup.ts에서 추출
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { ensureDir, copyDirRecursive, removeDirRecursive, log } from '../utils.js';

/**
 * .vibe/ → .claude/vibe/ 마이그레이션
 */
export function migrateLegacyVibe(projectRoot: string, vibeDir: string): boolean {
  const legacyVibeDir = path.join(projectRoot, '.vibe');

  if (!fs.existsSync(legacyVibeDir)) return false;

  ensureDir(vibeDir);

  try {
    const itemsToMigrate = ['specs', 'features', 'solutions', 'todos', 'memory', 'rules', 'config.json', 'constitution.md'];
    itemsToMigrate.forEach(item => {
      const src = path.join(legacyVibeDir, item);
      const dst = path.join(vibeDir, item);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        if (fs.statSync(src).isDirectory()) {
          copyDirRecursive(src, dst);
        } else {
          fs.copyFileSync(src, dst);
        }
      }
    });
    removeDirRecursive(legacyVibeDir);
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
      'vibe.analyze.md', 'vibe.compound.md', 'vibe.continue.md',
      'vibe.diagram.md', 'vibe.e2e.md', 'vibe.reason.md',
      'vibe.setup.md', 'vibe.ui.md'
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
 * 프로젝트 로컬 설정/자산 제거
 */
export function removeLocalAssets(claudeDir: string): void {
  const localAssets = [
    { path: path.join(claudeDir, 'settings.json'), isDir: false },
    { path: path.join(claudeDir, 'commands'), isDir: true },
    { path: path.join(claudeDir, 'agents'), isDir: true },
    { path: path.join(claudeDir, 'skills'), isDir: true },
  ];

  localAssets.forEach(asset => {
    if (fs.existsSync(asset.path)) {
      if (asset.isDir) {
        removeDirRecursive(asset.path);
      } else {
        fs.unlinkSync(asset.path);
      }
    }
  });
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
          if (projectConfig.mcpServers.vibe) {
            const vibeArgs = projectConfig.mcpServers.vibe.args || [];
            const isLocalPath = vibeArgs.some((arg: string) =>
              arg.includes('.vibe/mcp/') || arg.includes('.vibe\\mcp\\')
            );
            if (isLocalPath) {
              delete projectConfig.mcpServers.vibe;
              configModified = true;
              log(`   🧹 ${projectPath}: removed local vibe MCP\n`);
            }
          }
          if (projectConfig.mcpServers['vibe-gemini']) {
            const geminiArgs = projectConfig.mcpServers['vibe-gemini'].args || [];
            const isLocalPath = geminiArgs.some((arg: string) =>
              arg.includes('.vibe/') || arg.includes('.vibe\\')
            );
            if (isLocalPath) {
              delete projectConfig.mcpServers['vibe-gemini'];
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
export function cleanupLegacyMcp(vibeDir: string): void {
  const oldMcpDir = path.join(vibeDir, 'mcp');
  if (fs.existsSync(oldMcpDir)) {
    try {
      removeDirRecursive(oldMcpDir);
    } catch { /* ignore: optional operation */ }
  }
}
