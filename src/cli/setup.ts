/**
 * init/update 공통 설정 함수
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { VibeConfig, TechStack, StackDetails } from './types.js';
import { log, ensureDir, copyDirRecursive, removeDirRecursive, getPackageJson } from './utils.js';
import { registerMcp, unregisterMcp } from './mcp.js';
import { STACK_NAMES, getLanguageRulesContent } from './detect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// 전역 vibe 패키지 설치
// ============================================================================

/**
 * 전역 vibe 패키지 설치 경로:
 * - Windows: %APPDATA%\vibe\ (예: C:\Users\xxx\AppData\Roaming\vibe\)
 * - macOS/Linux: ~/.config/vibe/
 * 훅에서 전역 경로로 접근할 수 있게 함 (모든 프로젝트가 공유)
 */
export function getVibeConfigDir(): string {
  if (process.platform === 'win32') {
    // Windows: APPDATA 환경변수 사용
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe');
  }
  // macOS/Linux: XDG 표준
  return path.join(os.homedir(), '.config', 'vibe');
}

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
        log('   ℹ️  vibe package already installed (v' + currentVersion + ')\n');
        return;
      }
    } catch { /* ignore: reinstall if can't read */ }
  }

  log('   📦 Installing vibe package globally (~/.config/vibe/)...\n');

  // 디렉토리 생성
  ensureDir(globalVibeDir);
  ensureDir(nodeModulesDir);
  ensureDir(path.join(nodeModulesDir, '@su-record'));

  // 기존 설치 제거
  if (fs.existsSync(vibePackageDir)) {
    removeDirRecursive(vibePackageDir);
  }

  try {
    // 전역 npm에서 복사 (vibe는 전역으로 설치됨)
    const globalNpmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const globalNpmVibeDir = path.join(globalNpmRoot, '@su-record', 'vibe');

    if (fs.existsSync(globalNpmVibeDir)) {
      copyDirRecursive(globalNpmVibeDir, vibePackageDir);
      log('   ✅ vibe package installed globally (v' + currentVersion + ')\n');
    } else {
      // Install from npm if global npm install not found
      log('   ⬇️  Installing vibe package from npm...\n');
      execSync(`npm install @su-record/vibe@${currentVersion} --prefix "${globalVibeDir}" --no-save`, {
        stdio: 'pipe',
      });
      log('   ✅ vibe package installed globally (v' + currentVersion + ')\n');
    }

    // Copy hooks/scripts folder to VIBE_PATH (referenced by hooks.json)
    // Source priority: 1) Just installed package 2) Current package root (npm link etc)
    const packageRoot = path.resolve(__dirname, '..', '..');
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
      log('   ✅ Hook scripts installed (~/.config/vibe/hooks/scripts/)\n');
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    log('   ⚠️  vibe package global install failed: ' + message + '\n');
    log('   ℹ️  Manual install: cd ~/.config/vibe && npm install @su-record/vibe\n');
  }
}

// ============================================================================
// MCP 서버 등록
// ============================================================================

/**
 * MCP 서버 등록 (context7만 유지, GPT/Gemini는 Hook으로 대체)
 */
export function registerMcpServers(isUpdate = false): void {
  // 레거시 MCP 제거 (vibe, vibe-gemini, vibe-gpt)
  unregisterMcp('vibe');
  unregisterMcp('vibe-gemini');
  unregisterMcp('vibe-gpt');

  if (isUpdate) {
    unregisterMcp('context7');
  }

  // context7 MCP만 등록 (라이브러리 문서 검색용)
  try {
    registerMcp('context7', { command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'] });
    log(isUpdate ? '   ✅ context7 MCP registered globally\n' : '   ✅ Context7 MCP registered (library docs search)\n');
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('already exists')) {
      log('   ℹ️  Context7 MCP already registered\n');
    } else {
      log('   ⚠️  Context7 MCP manual registration required\n');
    }
  }

  log('   ℹ️  GPT/Gemini called via Hooks (no MCP needed)\n');
}

// ============================================================================
// constitution.md 생성/업데이트
// ============================================================================

/**
 * constitution.md 생성 또는 업데이트
 */
export function updateConstitution(
  vibeDir: string,
  detectedStacks: TechStack[],
  stackDetails: StackDetails
): void {
  const templatePath = path.join(__dirname, '../../vibe/templates/constitution-template.md');
  const constitutionPath = path.join(vibeDir, 'constitution.md');

  if (!fs.existsSync(templatePath)) return;

  let constitution = fs.readFileSync(templatePath, 'utf-8');

  const backendStack = detectedStacks.find(s =>
    s.type.includes('python') || s.type.includes('node') ||
    s.type.includes('go') || s.type.includes('java') || s.type.includes('rust')
  );
  const frontendStack = detectedStacks.find(s =>
    s.type.includes('react') || s.type.includes('vue') ||
    s.type.includes('flutter') || s.type.includes('swift') || s.type.includes('android')
  );

  if (backendStack && STACK_NAMES[backendStack.type]) {
    const info = STACK_NAMES[backendStack.type];
    constitution = constitution.replace('- Language: {Python 3.11+ / Node.js / etc.}', `- Language: ${info.lang}`);
    constitution = constitution.replace('- Framework: {FastAPI / Express / etc.}', `- Framework: ${info.framework}`);
  }

  if (frontendStack && STACK_NAMES[frontendStack.type]) {
    const info = STACK_NAMES[frontendStack.type];
    constitution = constitution.replace('- Framework: {Flutter / React / etc.}', `- Framework: ${info.framework}`);
  }

  constitution = constitution.replace(
    '- Database: {PostgreSQL / MongoDB / etc.}',
    stackDetails.databases.length > 0 ? `- Database: ${stackDetails.databases.join(', ')}` : '- Database: (configure for your project)'
  );
  constitution = constitution.replace(
    '- State Management: {Provider / Redux / etc.}',
    stackDetails.stateManagement.length > 0 ? `- State Management: ${stackDetails.stateManagement.join(', ')}` : '- State Management: (configure for your project)'
  );
  constitution = constitution.replace(
    '- Hosting: {Cloud Run / Vercel / etc.}',
    stackDetails.hosting.length > 0 ? `- Hosting: ${stackDetails.hosting.join(', ')}` : '- Hosting: (configure for your project)'
  );
  constitution = constitution.replace(
    '- CI/CD: {GitHub Actions / etc.}',
    stackDetails.cicd.length > 0 ? `- CI/CD: ${stackDetails.cicd.join(', ')}` : '- CI/CD: (configure for your project)'
  );

  fs.writeFileSync(constitutionPath, constitution);
}

// ============================================================================
// CLAUDE.md 업데이트
// ============================================================================

/**
 * CLAUDE.md 업데이트 (vibe 섹션 추가/교체)
 */
export function updateClaudeMd(
  projectRoot: string,
  detectedStacks: TechStack[],
  isUpdate = false
): void {
  const vibeClaudeMd = path.join(__dirname, '../../CLAUDE.md');
  const projectClaudeMd = path.join(projectRoot, 'CLAUDE.md');

  if (!fs.existsSync(vibeClaudeMd)) return;

  let vibeContent = fs.readFileSync(vibeClaudeMd, 'utf-8');

  // 감지된 기술 스택에 따라 언어별 규칙 추가
  const languageRules = getLanguageRulesContent(detectedStacks);
  if (languageRules) {
    vibeContent = vibeContent.replace(
      '### 에러 처리 필수',
      languageRules + '\n\n### 에러 처리 필수'
    );
  }

  if (fs.existsSync(projectClaudeMd)) {
    const existingContent = fs.readFileSync(projectClaudeMd, 'utf-8');

    if (isUpdate) {
      // update: vibe 섹션 찾아서 교체
      const vibeStartMarker = '# VIBE';
      const sectionSeparator = '\n---\n';

      if (existingContent.includes(vibeStartMarker)) {
        const vibeStartIdx = existingContent.indexOf(vibeStartMarker);
        const beforeVibe = existingContent.substring(0, vibeStartIdx).trimEnd();
        const afterVibeStart = existingContent.substring(vibeStartIdx);
        const nextSeparatorIdx = afterVibeStart.indexOf(sectionSeparator);

        let afterVibe = '';
        if (nextSeparatorIdx !== -1) {
          afterVibe = afterVibeStart.substring(nextSeparatorIdx);
        }

        const newContent = beforeVibe + (beforeVibe ? '\n\n---\n\n' : '') + vibeContent + afterVibe;
        fs.writeFileSync(projectClaudeMd, newContent);
        log('   ✅ CLAUDE.md vibe section updated\n');
      } else if (!existingContent.includes('/vibe.spec')) {
        const mergedContent = existingContent.trim() + '\n\n---\n\n' + vibeContent;
        fs.writeFileSync(projectClaudeMd, mergedContent);
        log('   ✅ CLAUDE.md vibe section added\n');
      } else {
        log('   ℹ️  CLAUDE.md vibe section kept\n');
      }
    } else {
      // init: add if not exists
      if (!existingContent.includes('/vibe.spec')) {
        const mergedContent = existingContent.trim() + '\n\n---\n\n' + vibeContent;
        fs.writeFileSync(projectClaudeMd, mergedContent);
        log('   ✅ CLAUDE.md vibe section added\n');
      } else {
        log('   ℹ️  CLAUDE.md vibe section already exists\n');
      }
    }
  } else {
    fs.writeFileSync(projectClaudeMd, vibeContent);
    log('   ✅ CLAUDE.md created\n');
  }
}

// ============================================================================
// 규칙 복사/업데이트
// ============================================================================

/**
 * vibe/ 폴더 전체 복사 + languages/ 스택별 필터링
 */
export function updateRules(vibeDir: string, detectedStacks: TechStack[], isUpdate = false): void {
  // 1. vibe/ 폴더 전체 복사 (rules/, templates/, config.json 등)
  const vibeSource = path.join(__dirname, '../../vibe');
  if (fs.existsSync(vibeSource)) {
    copyDirRecursive(vibeSource, vibeDir);
  }

  // 2. languages/ 폴더 처리 (루트에서 별도 복사, 스택별 필터링)
  const langSource = path.join(__dirname, '../../languages');
  const langTarget = path.join(vibeDir, 'languages');

  if (isUpdate && fs.existsSync(langTarget)) {
    removeDirRecursive(langTarget);
  }
  ensureDir(langTarget);

  // 감지된 스택 타입에 해당하는 언어 규칙만 복사
  const detectedTypes = new Set(detectedStacks.map(s => s.type));

  if (fs.existsSync(langSource)) {
    const langFiles = fs.readdirSync(langSource);
    langFiles.forEach(file => {
      const langType = file.replace('.md', '');
      if (detectedTypes.has(langType)) {
        fs.copyFileSync(path.join(langSource, file), path.join(langTarget, file));
      }
    });
  }

  log('   ✅ Coding rules ' + (isUpdate ? 'updated' : 'installed') + ' (.claude/vibe/)\n');
}

// ============================================================================
// 전역 assets 설치/업데이트
// ============================================================================

/**
 * ~/.claude/ 전역 assets 설치 (commands, agents, skills, hooks)
 */
export function installGlobalAssets(isUpdate = false): void {
  const globalClaudeDir = path.join(os.homedir(), '.claude');
  ensureDir(globalClaudeDir);

  // commands
  const globalCommandsDir = path.join(globalClaudeDir, 'commands');
  ensureDir(globalCommandsDir);
  const commandsSource = path.join(__dirname, '../../commands');
  copyDirRecursive(commandsSource, globalCommandsDir);
  log('   ✅ Slash commands ' + (isUpdate ? 'updated' : 'installed') + ' (~/.claude/commands/)\n');

  // agents
  const globalAgentsDir = path.join(globalClaudeDir, 'agents');
  ensureDir(globalAgentsDir);
  const agentsSource = path.join(__dirname, '../../agents');
  copyDirRecursive(agentsSource, globalAgentsDir);
  log('   ✅ Subagents ' + (isUpdate ? 'updated' : 'installed') + ' (~/.claude/agents/)\n');

  // skills
  const globalSkillsDir = path.join(globalClaudeDir, 'skills');
  ensureDir(globalSkillsDir);
  const skillsSource = path.join(__dirname, '../../skills');
  if (fs.existsSync(skillsSource)) {
    copyDirRecursive(skillsSource, globalSkillsDir);
    log('   ✅ Skills ' + (isUpdate ? 'updated' : 'installed') + ' (~/.claude/skills/)\n');
  }

  // hooks - 템플릿에서 {{VIBE_PATH}}를 실제 경로로 치환
  const globalSettingsPath = path.join(globalClaudeDir, 'settings.json');
  const hooksTemplate = path.join(__dirname, '../../hooks/hooks.json');
  if (fs.existsSync(hooksTemplate)) {
    // 템플릿 읽고 플레이스홀더 치환
    let hooksContent = fs.readFileSync(hooksTemplate, 'utf-8');
    const vibeConfigPath = getVibeConfigDir();

    // Windows 경로는 file:// URL에서 슬래시 사용해야 함
    const vibePathForUrl = vibeConfigPath.replace(/\\/g, '/');
    hooksContent = hooksContent.replace(/\{\{VIBE_PATH\}\}/g, vibePathForUrl);

    const vibeHooks = JSON.parse(hooksContent);

    if (fs.existsSync(globalSettingsPath)) {
      const existingSettings = JSON.parse(fs.readFileSync(globalSettingsPath, 'utf-8'));
      existingSettings.hooks = vibeHooks.hooks;
      fs.writeFileSync(globalSettingsPath, JSON.stringify(existingSettings, null, 2));
    } else {
      fs.writeFileSync(globalSettingsPath, hooksContent);
    }
    log('   ✅ Hooks ' + (isUpdate ? 'updated' : 'installed') + ' (~/.claude/settings.json)\n');
    log('   ℹ️  VIBE_PATH: ' + vibeConfigPath + '\n');
  }
}

// ============================================================================
// 레거시 마이그레이션
// ============================================================================

/**
 * .vibe/ → .claude/vibe/ 마이그레이션
 */
export function migrateLegacyVibe(projectRoot: string, vibeDir: string): boolean {
  const legacyVibeDir = path.join(projectRoot, '.vibe');

  if (!fs.existsSync(legacyVibeDir)) return false;

  log('   🔄 Migrating legacy .vibe/ folder...\n');
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
    log('   ✅ .vibe/ → .claude/vibe/ migration complete\n');
    return true;
  } catch { /* ignore: optional operation */
    log('   ⚠️  Migration failed - manual deletion of .vibe/ required\n');
    return false;
  }
}

// ============================================================================
// .gitignore 업데이트
// ============================================================================

/**
 * .gitignore 업데이트 (레거시 정리)
 */
export function updateGitignore(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  if (!fs.existsSync(gitignorePath)) return;

  let gitignore = fs.readFileSync(gitignorePath, 'utf-8');
  let modified = false;

  // 레거시 mcp 폴더 제외 제거
  if (gitignore.includes('.claude/vibe/mcp/')) {
    gitignore = gitignore.replace(/# vibe MCP\n\.claude\/vibe\/mcp\/\n?/g, '');
    gitignore = gitignore.replace(/\.claude\/vibe\/mcp\/\n?/g, '');
    modified = true;
  }

  // 레거시 node_modules 제외 제거 (전역으로 이동됨)
  if (gitignore.includes('.claude/vibe/node_modules/')) {
    gitignore = gitignore.replace(/# vibe local packages\n\.claude\/vibe\/node_modules\/\n?/g, '');
    gitignore = gitignore.replace(/\.claude\/vibe\/node_modules\/\n?/g, '');
    modified = true;
  }

  // settings.local.json 제거
  if (gitignore.includes('settings.local.json')) {
    gitignore = gitignore.replace(/\.claude\/settings\.local\.json\n?/g, '');
    gitignore = gitignore.replace(/settings\.local\.json\n?/g, '');
    modified = true;
    log('   ✅ Removed settings.local.json from .gitignore\n');
  }

  if (modified) {
    fs.writeFileSync(gitignorePath, gitignore);
  }
}

// ============================================================================
// config.json 생성/업데이트
// ============================================================================

/**
 * config.json 생성 또는 업데이트
 */
export function updateConfig(
  vibeDir: string,
  detectedStacks: TechStack[],
  stackDetails: StackDetails,
  isUpdate = false
): void {
  const configPath = path.join(vibeDir, 'config.json');

  if (isUpdate && fs.existsSync(configPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config.stacks = detectedStacks;
      config.details = stackDetails;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch { /* ignore: optional operation */ }
  } else {
    const config: VibeConfig = {
      language: 'ko',
      quality: { strict: true, autoVerify: true },
      stacks: detectedStacks,
      details: stackDetails
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
}

// ============================================================================
// 레거시 정리
// ============================================================================

/**
 * 레거시 파일/폴더 정리
 */
export function cleanupLegacy(projectRoot: string, claudeDir: string): void {
  // .agent/rules/ 정리
  const oldRulesDir = path.join(projectRoot, '.agent/rules');
  const oldAgentDir = path.join(projectRoot, '.agent');
  if (fs.existsSync(oldRulesDir)) {
    log('   🔄 Migration: .agent/rules/ → .claude/vibe/rules/\n');
    removeDirRecursive(oldRulesDir);
    if (fs.existsSync(oldAgentDir) && fs.readdirSync(oldAgentDir).length === 0) {
      fs.rmdirSync(oldAgentDir);
    }
    log('   ✅ Legacy .agent/rules/ folder cleaned up\n');
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

  // 프로젝트 로컬 settings.json 제거 (전역으로 이동됨)
  const localSettingsPath = path.join(claudeDir, 'settings.json');
  if (fs.existsSync(localSettingsPath)) {
    log('   🧹 Removing local settings.json (moved to global)...\n');
    try {
      fs.unlinkSync(localSettingsPath);
      log('   ✅ .claude/settings.json deleted\n');
    } catch { /* ignore: optional operation */
      log('   ⚠️  .claude/settings.json manual deletion required\n');
    }
  }
}

/**
 * 프로젝트 로컬 설정/자산 제거 (전역으로 이동됨)
 */
export function removeLocalAssets(claudeDir: string): void {
  const localAssets = [
    { path: path.join(claudeDir, 'settings.json'), isDir: false },
    { path: path.join(claudeDir, 'settings.local.json'), isDir: false },
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
      const name = path.basename(asset.path);
      log(`   🧹 Removed local ${name}${asset.isDir ? '/' : ''} (moved to global)\n`);
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
      log('   ✅ ~/.claude.json local MCP settings cleaned up\n');
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    log('   ⚠️  ~/.claude.json cleanup failed: ' + message + '\n');
  }
}

/**
 * 레거시 mcp/ 폴더 정리
 */
export function cleanupLegacyMcp(vibeDir: string): void {
  const oldMcpDir = path.join(vibeDir, 'mcp');
  if (fs.existsSync(oldMcpDir)) {
    log('   🧹 Cleaning up legacy mcp/ folder...\n');
    try {
      removeDirRecursive(oldMcpDir);
      log('   ✅ mcp/ folder deleted\n');
    } catch { /* ignore: optional operation */
      log('   ⚠️  mcp/ folder manual deletion required\n');
    }
  }
}
