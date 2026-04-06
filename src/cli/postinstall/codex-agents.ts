/**
 * Codex 플러그인 설치
 *
 * Codex v0.117.0+ 플러그인 시스템 대응.
 * agents + skills → ~/.codex/plugins/vibe/ 플러그인 번들로 패키징.
 *
 * 생성 구조:
 *   ~/.codex/plugins/vibe/
 *   ├── .codex-plugin/plugin.json
 *   ├── skills/
 *   ├── agents/
 *   └── AGENTS.md
 */

import path from 'path';
import fs from 'fs';
import { ensureDir, removeDirRecursive, copySkillsFiltered, removeLegacySkills } from './fs-utils.js';
import { GLOBAL_SKILLS, LEGACY_SKILL_DIRS } from './constants.js';
import { generateCodexAgentsMd } from './codex-instruction.js';

/**
 * package.json에서 버전 읽기
 */
function getPackageVersion(packageRoot: string): string {
  try {
    const pkgPath = path.join(packageRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * .codex-plugin/plugin.json 매니페스트 생성
 */
function writePluginManifest(pluginDir: string, version: string): void {
  const manifestDir = path.join(pluginDir, '.codex-plugin');
  ensureDir(manifestDir);

  const manifest = {
    name: 'vibe',
    version,
    description: 'VIBE — Easy vibe coding with minimum quality guaranteed',
    skills: './skills/',
    agents: './agents/',
  };

  fs.writeFileSync(
    path.join(manifestDir, 'plugin.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf-8',
  );
}

/**
 * agents/*.md → pluginDir/agents/ 재귀 복사 (YAML frontmatter 제거)
 */
function installAgentsToPlugin(agentsSource: string, pluginAgentsDir: string): number {
  if (!fs.existsSync(agentsSource)) return 0;

  ensureDir(pluginAgentsDir);
  let installed = 0;

  function processDirectory(srcDir: string, destDir: string): void {
    ensureDir(destDir);
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        processDirectory(srcPath, destPath);
      } else if (entry.name.endsWith('.md')) {
        try {
          let content = fs.readFileSync(srcPath, 'utf-8');
          content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          content = content.replace(/^---\n[\s\S]*?\n---\n/, '');
          fs.writeFileSync(destPath, content.trimStart(), 'utf-8');
          installed++;
        } catch {
          // skip failed files
        }
      }
    }
  }

  processDirectory(agentsSource, pluginAgentsDir);
  return installed;
}

/**
 * Codex 플러그인 설치 (agents + skills + manifest + AGENTS.md)
 *
 * @param agentsSource - agents/ 소스 디렉토리
 * @param skillsSource - skills/ 소스 디렉토리
 * @param codexConfigDir - ~/.codex/ 디렉토리
 * @param packageRoot - 패키지 루트 디렉토리
 */
export function installCodexPlugin(
  agentsSource: string,
  skillsSource: string,
  codexConfigDir: string,
  packageRoot: string,
): void {
  const pluginDir = path.join(codexConfigDir, 'plugins', 'vibe');

  // 클린 설치
  if (fs.existsSync(pluginDir)) {
    removeDirRecursive(pluginDir);
  }
  ensureDir(pluginDir);

  // 1. 매니페스트 생성
  const version = getPackageVersion(packageRoot);
  writePluginManifest(pluginDir, version);

  // 2. Agents 설치
  const agentCount = installAgentsToPlugin(
    agentsSource,
    path.join(pluginDir, 'agents'),
  );

  // 3. Skills 설치
  const pluginSkillsDir = path.join(pluginDir, 'skills');
  if (fs.existsSync(skillsSource)) {
    ensureDir(pluginSkillsDir);
    removeLegacySkills(pluginSkillsDir, LEGACY_SKILL_DIRS);
    copySkillsFiltered(skillsSource, pluginSkillsDir, GLOBAL_SKILLS);
  }

  // 4. AGENTS.md 생성 (플러그인 내부)
  generateCodexAgentsMd(pluginDir, packageRoot);

  console.log(`   📦 Codex plugin: ${agentCount} agents installed → ${pluginDir}`);
}

// 레거시 호환 — installCodexAgents 이름으로도 export
export const installCodexAgents = installCodexPlugin;
