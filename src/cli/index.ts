#!/usr/bin/env node

/**
 * vibe CLI (TypeScript version 2.0)
 * SPEC-driven AI coding framework (Claude Code exclusive)
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// 분리된 모듈 import
import { CliOptions, VibeConfig } from './types.js';
import {
  log,
  setSilentMode,
  ensureDir,
  removeDirRecursive,
  getPackageJson,
  compareVersions,
} from './utils.js';
import { detectTechStacks } from './detect.js';
import { formatLLMStatus, getLLMAuthStatus } from './auth.js';
import { setupCollaboratorAutoInstall } from './collaborator.js';
import {
  setupExternalLLM,
  removeExternalLLM,
  gptAuth,
  gptStatus,
  gptLogout,
  geminiAuth,
  geminiStatus,
  geminiLogout,
  showAuthHelp,
  showLogoutHelp,
} from './llm.js';
import {
  updateConstitution,
  updateClaudeMd,
  updateRules,
  migrateLegacyVibe,
  updateGitignore,
  updateConfig,
  cleanupLegacy,
  removeLocalAssets,
  cleanupClaudeConfig,
  cleanupLegacyMcp,
  installProjectHooks,
} from './setup.js';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Constants
// ============================================================================

const args = process.argv.slice(2);
const command = args[0];

const options: CliOptions = {
  silent: args.includes('--silent') || args.includes('-s')
};

const skipUpgrade = args.includes('--skip-upgrade');

const positionalArgs = args.filter(arg => !arg.startsWith('-'));

// Silent 모드 설정
setSilentMode(options.silent);

// ============================================================================
// Main Commands
// ============================================================================

async function init(projectName?: string): Promise<void> {
  try {
    let projectRoot = process.cwd();
    let isNewProject = false;

    if (projectName) {
      projectRoot = path.join(process.cwd(), projectName);

      if (fs.existsSync(projectRoot)) {
        log(`❌ Folder already exists: ${projectName}/`);
        return;
      }

      log(`📁 Creating project: ${projectName}/\n`);
      fs.mkdirSync(projectRoot, { recursive: true });
      isNewProject = true;
    }

    const claudeDir = path.join(projectRoot, '.claude');
    const vibeDir = path.join(claudeDir, 'vibe');
    if (fs.existsSync(vibeDir)) {
      log('❌ .claude/vibe/ already exists.');
      return;
    }

    ensureDir(vibeDir);

    // 레거시 마이그레이션
    migrateLegacyVibe(projectRoot, vibeDir);

    // .gitignore 업데이트
    updateGitignore(projectRoot);

    // 기술 스택 감지
    const { stacks: detectedStacks, details: stackDetails } = detectTechStacks(projectRoot);
    if (detectedStacks.length > 0) {
      log(`   🔍 Detected stacks:\n`);
      detectedStacks.forEach(s => {
        log(`      - ${s.type}${s.path ? ` (${s.path}/)` : ''}\n`);
      });
      if (stackDetails.databases.length > 0) {
        log(`      - DB: ${stackDetails.databases.join(', ')}\n`);
      }
      if (stackDetails.stateManagement.length > 0) {
        log(`      - State: ${stackDetails.stateManagement.join(', ')}\n`);
      }
    }

    // constitution.md 생성
    updateConstitution(vibeDir, detectedStacks, stackDetails);

    // config.json 생성
    updateConfig(vibeDir, detectedStacks, stackDetails, false);

    // CLAUDE.md 병합
    updateClaudeMd(projectRoot, detectedStacks, false);

    // 규칙 복사
    updateRules(vibeDir, detectedStacks, false);

    // 협업자 자동 설치 설정
    setupCollaboratorAutoInstall(projectRoot);

    // 프로젝트 레벨 훅 설치
    installProjectHooks(projectRoot);

    // 완료 메시지
    const packageJson = getPackageJson();

    log(`✅ vibe initialized (v${packageJson.version})
${formatLLMStatus()}
📦 Context7 plugin (recommended): /plugin install context7

Next: ${isNewProject ? `cd ${projectName} && ` : ''}/vibe.spec "feature"
`);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Init failed:', message);
    process.exit(1);
  }
}

async function checkAndUpgradeVibe(): Promise<boolean> {
  const currentVersion = getPackageJson().version;

  try {
    const latestVersion = execSync('npm view @su-record/vibe version', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    const isNewer = compareVersions(latestVersion, currentVersion) > 0;
    if (isNewer) {
      log(`⬆️ Upgrading v${currentVersion} → v${latestVersion}...\n`);

      execSync('npm install -g @su-record/vibe@latest', {
        stdio: options.silent ? 'pipe' : 'inherit'
      });

      // 업그레이드 완료 후 새 버전으로 설정 업데이트 (--skip-upgrade로 무한 루프 방지)
      execSync(`vibe update --skip-upgrade${options.silent ? ' --silent' : ''}`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      return true;
    }
    return false;
  } catch { /* ignore: optional operation */
    return false;
  }
}

async function update(): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const vibeDir = path.join(projectRoot, '.claude', 'vibe');
    const claudeDir = path.join(projectRoot, '.claude');
    const legacyVibeDir = path.join(projectRoot, '.vibe');

    // CI/프로덕션 환경에서는 스킵
    if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
      return;
    }

    // 1. 최신 버전 확인 및 업그레이드 (전역 패키지 먼저)
    // npm install -g 실행 시 postinstall이 전역 설정을 자동 처리
    // --skip-upgrade 플래그가 있으면 업그레이드 체크 건너뜀 (무한 루프 방지)
    if (!skipUpgrade) {
      const wasUpgraded = await checkAndUpgradeVibe();
      if (wasUpgraded) return;
    }

    // 2. 프로젝트 설정 업데이트
    // 레거시 마이그레이션
    if (fs.existsSync(legacyVibeDir) && !fs.existsSync(vibeDir)) {
      migrateLegacyVibe(projectRoot, vibeDir);
    }

    if (!fs.existsSync(vibeDir) && !fs.existsSync(legacyVibeDir)) {
      if (!options.silent) {
        console.log('❌ Not a vibe project. Run vibe init first.');
      }
      return;
    }

    ensureDir(vibeDir);

    // 레거시 정리
    cleanupLegacy(projectRoot, claudeDir);

    // 기술 스택 감지
    const { stacks: detectedStacks, details: stackDetails } = detectTechStacks(projectRoot);

    // config.json 업데이트
    updateConfig(vibeDir, detectedStacks, stackDetails, true);

    // constitution.md 업데이트
    updateConstitution(vibeDir, detectedStacks, stackDetails);

    // CLAUDE.md 업데이트
    updateClaudeMd(projectRoot, detectedStacks, true);

    // 규칙 업데이트
    updateRules(vibeDir, detectedStacks, true);

    // 프로젝트 로컬 자산 제거
    removeLocalAssets(claudeDir);

    // .gitignore 업데이트
    updateGitignore(projectRoot);

    // 협업자 자동 설치 설정
    setupCollaboratorAutoInstall(projectRoot);

    // 프로젝트 레벨 훅 설치
    installProjectHooks(projectRoot);

    // ~/.claude.json 정리
    cleanupClaudeConfig();

    // 레거시 mcp 폴더 정리
    cleanupLegacyMcp(vibeDir);

    const packageJson = getPackageJson();

    log(`✅ vibe updated (v${packageJson.version})
${formatLLMStatus()}
📦 Context7 plugin (recommended): /plugin install context7
`);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Update failed:', message);
    process.exit(1);
  }
}

function remove(): void {
  const projectRoot = process.cwd();
  const vibeDir = path.join(projectRoot, '.claude', 'vibe');
  const legacyVibeDir = path.join(projectRoot, '.vibe');
  const claudeDir = path.join(projectRoot, '.claude');

  if (!fs.existsSync(vibeDir) && !fs.existsSync(legacyVibeDir)) {
    console.log('❌ Not a vibe project.');
    return;
  }

  console.log('🗑️  Removing vibe...\n');


  // .claude/vibe 폴더 제거
  if (fs.existsSync(vibeDir)) {
    removeDirRecursive(vibeDir);
    console.log('   ✅ .claude/vibe/ removed\n');
  }

  // 레거시 .vibe 폴더도 제거
  if (fs.existsSync(legacyVibeDir)) {
    removeDirRecursive(legacyVibeDir);
    console.log('   ✅ .vibe/ removed (legacy)\n');
  }

  // .claude/commands 제거
  const commandsDir = path.join(claudeDir, 'commands');
  if (fs.existsSync(commandsDir)) {
    const vibeCommands = ['vibe.spec.md', 'vibe.run.md', 'vibe.verify.md', 'vibe.reason.md', 'vibe.analyze.md', 'vibe.ui.md', 'vibe.diagram.md'];
    vibeCommands.forEach(cmd => {
      const cmdPath = path.join(commandsDir, cmd);
      if (fs.existsSync(cmdPath)) {
        fs.unlinkSync(cmdPath);
      }
    });
    console.log('   ✅ Slash commands removed\n');
  }

  // .claude/agents 제거
  const agentsDir = path.join(claudeDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    const vibeAgents = ['simplifier.md', 'explorer.md', 'implementer.md', 'tester.md', 'searcher.md'];
    vibeAgents.forEach(agent => {
      const agentPath = path.join(agentsDir, agent);
      if (fs.existsSync(agentPath)) {
        fs.unlinkSync(agentPath);
      }
    });
    console.log('   ✅ Subagents removed\n');
  }

  // .claude/settings.json에서 hooks 제거
  const settingsPath = path.join(claudeDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (settings.hooks) {
        delete settings.hooks;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        console.log('   ✅ Hooks removed\n');
      }
    } catch { /* ignore: optional operation */ }
  }

  console.log(`
✅ vibe removed!

Removed:
  - MCP server (context7)
  - .claude/vibe/ folder
  - Slash commands (7)
  - Subagents (5)
  - Hooks settings

To reinstall: vibe init
  `);
}

// ============================================================================
// Info Commands
// ============================================================================

function showHelp(): void {
  console.log(`
📖 Vibe - SPEC-driven AI coding framework (Claude Code exclusive)

Commands:
  vibe init [project]     Initialize project
  vibe update             Update settings
  vibe status             Show status
  vibe help               Help
  vibe version            Version

GPT:
  vibe gpt auth           OAuth authentication (Plus/Pro)
  vibe gpt key <KEY>      Set API key
  vibe gpt status         Check status
  vibe gpt logout         Logout
  vibe gpt remove         Remove config

Gemini:
  vibe gemini auth        OAuth authentication
  vibe gemini key <KEY>   Set API key
  vibe gemini status      Check status
  vibe gemini logout      Logout
  vibe gemini remove      Remove config

Slash Commands (Claude Code):
  /vibe.spec "feature"    Create SPEC + parallel research
  /vibe.run "feature"     Execute implementation
  /vibe.verify "feature"  BDD verification
  /vibe.review            Parallel code review (13+ agents)
  /vibe.reason "problem"  Systematic reasoning
  /vibe.analyze           Project analysis
  /vibe.utils             Utilities (--e2e, --diagram, --continue)

LLM Routing:
  gpt. / gemini.          Direct LLM call with web search
  Auto-routing via hooks  (architecture→GPT, UI/UX→Gemini)

Workflow: /vibe.spec → /vibe.run → /vibe.verify

Docs: https://github.com/su-record/vibe
  `);
}

function showStatus(): void {
  const projectRoot = process.cwd();
  const vibeDir = path.join(projectRoot, '.claude', 'vibe');
  const configPath = path.join(vibeDir, 'config.json');

  const packageJson = getPackageJson();
  const isVibeProject = fs.existsSync(vibeDir);

  let config: VibeConfig = { language: 'ko', models: {} };
  if (isVibeProject && fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  // 실제 OAuth 인증 상태 확인 (전역 설정)
  const authStatus = getLLMAuthStatus();

  // GPT 상태: OAuth 인증 > config enabled
  let gptStatusText = '⬚ Disabled';
  if (authStatus.gpt?.valid) {
    gptStatusText = authStatus.gpt.type === 'oauth'
      ? `✅ OAuth (${authStatus.gpt.email})`
      : '✅ API Key';
  } else if (config.models?.gpt?.enabled) {
    gptStatusText = '⚠️  Configured (auth required)';
  }

  // Gemini 상태: OAuth 인증 > config enabled
  let geminiStatusText = '⬚ Disabled';
  if (authStatus.gemini?.valid) {
    geminiStatusText = authStatus.gemini.type === 'oauth'
      ? `✅ OAuth (${authStatus.gemini.email})`
      : '✅ API Key';
  } else if (config.models?.gemini?.enabled) {
    geminiStatusText = '⚠️  Configured (auth required)';
  }

  // 프로젝트 상태
  const projectStatus = isVibeProject
    ? `✅ ${projectRoot}`
    : `⬚ Not a vibe project (run: vibe init)`;

  console.log(`
📊 Vibe Status (v${packageJson.version})

Project: ${projectStatus}
${isVibeProject ? `Language: ${config.language || 'ko'}` : ''}

Models:
  Opus 4.5          Orchestrator
  Sonnet 4          Implementation
  Haiku 4.5         Code exploration
  GPT 5.2           ${gptStatusText}
  Gemini 3          ${geminiStatusText}

MCP:
  context7          Library docs search
  `);
}

function showVersion(): void {
  const packageJson = getPackageJson();
  console.log(`vibe v${packageJson.version}`);
}

// ============================================================================
// Tool Exports (for slash commands)
// ============================================================================

export * from '../lib/MemoryManager.js';
export * from '../lib/ProjectCache.js';
export * from '../lib/ContextCompressor.js';

export { saveMemory } from '../tools/memory/saveMemory.js';
export { recallMemory } from '../tools/memory/recallMemory.js';
export { listMemories } from '../tools/memory/listMemories.js';
export { deleteMemory } from '../tools/memory/deleteMemory.js';
export { updateMemory } from '../tools/memory/updateMemory.js';
export { searchMemoriesHandler as searchMemories } from '../tools/memory/searchMemories.js';
export { linkMemories } from '../tools/memory/linkMemories.js';
export { getMemoryGraph } from '../tools/memory/getMemoryGraph.js';
export { createMemoryTimeline } from '../tools/memory/createMemoryTimeline.js';
export { searchMemoriesAdvanced } from '../tools/memory/searchMemoriesAdvanced.js';
export { startSession } from '../tools/memory/startSession.js';
export { autoSaveContext } from '../tools/memory/autoSaveContext.js';
export { restoreSessionContext } from '../tools/memory/restoreSessionContext.js';
export { prioritizeMemory } from '../tools/memory/prioritizeMemory.js';
export { getSessionContext } from '../tools/memory/getSessionContext.js';

export { findSymbol } from '../tools/semantic/findSymbol.js';
export { findReferences } from '../tools/semantic/findReferences.js';
export { analyzeDependencyGraph } from '../tools/semantic/analyzeDependencyGraph.js';

export { analyzeComplexity } from '../tools/convention/analyzeComplexity.js';
export { validateCodeQuality } from '../tools/convention/validateCodeQuality.js';
export { checkCouplingCohesion } from '../tools/convention/checkCouplingCohesion.js';
export { suggestImprovements } from '../tools/convention/suggestImprovements.js';
export { applyQualityRules } from '../tools/convention/applyQualityRules.js';

export { previewUiAscii } from '../tools/ui/previewUiAscii.js';
export { getCurrentTime } from '../tools/time/getCurrentTime.js';

// ============================================================================
// Main Router
// ============================================================================

switch (command) {
  case 'init':
    init(positionalArgs[1]);
    break;

  case 'update':
    update();
    break;

  case 'remove':
  case 'uninstall':
    remove();
    break;

  // vibe gpt <subcommand>
  case 'gpt': {
    const subCommand = positionalArgs[1];
    switch (subCommand) {
      case 'auth':
        gptAuth();
        break;
      case 'key': {
        const apiKey = positionalArgs[2] || args.find(a => !a.startsWith('-') && a !== 'gpt' && a !== 'key');
        if (apiKey) {
          setupExternalLLM('gpt', apiKey);
        } else {
          console.log('Usage: vibe gpt key <API_KEY>');
        }
        break;
      }
      case 'logout':
        gptLogout();
        break;
      case 'remove':
        removeExternalLLM('gpt');
        break;
      case 'status':
        gptStatus();
        break;
      default:
        console.log(`
GPT Commands:
  vibe gpt auth     OAuth authentication (Plus/Pro)
  vibe gpt key      Set API key
  vibe gpt status   Check status
  vibe gpt logout   Logout
  vibe gpt remove   Remove config
        `);
    }
    break;
  }

  // vibe gemini <subcommand>
  case 'gemini': {
    const subCommand = positionalArgs[1];
    switch (subCommand) {
      case 'auth':
        geminiAuth();
        break;
      case 'key': {
        const apiKey = positionalArgs[2] || args.find(a => !a.startsWith('-') && a !== 'gemini' && a !== 'key');
        if (apiKey) {
          setupExternalLLM('gemini', apiKey);
        } else {
          console.log('Usage: vibe gemini key <API_KEY>');
        }
        break;
      }
      case 'logout':
        geminiLogout();
        break;
      case 'remove':
        removeExternalLLM('gemini');
        break;
      case 'status':
        geminiStatus();
        break;
      default:
        console.log(`
Gemini Commands:
  vibe gemini auth     OAuth authentication
  vibe gemini key      Set API key
  vibe gemini status   Check status
  vibe gemini logout   Logout
  vibe gemini remove   Remove config
        `);
    }
    break;
  }

  case 'status':
    showStatus();
    break;

  case 'version':
  case '-v':
  case '--version':
    showVersion();
    break;

  case 'help':
  case '-h':
  case '--help':
  case undefined:
    showHelp();
    break;

  default:
    console.log(`
❌ Unknown command: ${command}

Available commands:
  vibe init         Initialize project
  vibe update       Update settings
  vibe gpt <cmd>    GPT commands (auth, key, status, logout)
  vibe gemini <cmd> Gemini commands (auth, key, status, logout)
  vibe status       Show status
  vibe remove       Remove vibe
  vibe help         Help
  vibe version      Version info

Usage: vibe help
    `);
    process.exit(1);
}
