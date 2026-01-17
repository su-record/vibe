#!/usr/bin/env node

/**
 * vibe CLI (TypeScript version 2.0)
 * SPEC-driven AI coding framework (Claude Code 전용)
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
import { unregisterMcp } from './mcp.js';
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
  registerMcpServers,
  updateConstitution,
  updateClaudeMd,
  updateRules,
  installGlobalAssets,
  installGlobalVibePackage,
  migrateLegacyVibe,
  updateGitignore,
  updateConfig,
  cleanupLegacy,
  removeLocalAssets,
  cleanupClaudeConfig,
  cleanupLegacyMcp,
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

    // MCP 서버 등록 (context7)
    log('🔧 Registering settings (global)...\n');
    registerMcpServers(false);

    // .claude/vibe 폴더 구조 생성
    ['specs', 'features'].forEach(dir => {
      ensureDir(path.join(vibeDir, dir));
    });

    // 레거시 마이그레이션
    migrateLegacyVibe(projectRoot, vibeDir);

    // .gitignore 업데이트
    updateGitignore(projectRoot);

    // 전역 vibe 패키지 먼저 설치 (~/.config/vibe/) - hooks에서 참조함
    installGlobalVibePackage(false);

    // 전역 assets 설치 (hooks가 위에서 설치된 패키지 참조)
    installGlobalAssets(false);

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

    // 완료 메시지
    const packageJson = getPackageJson();
    log(`✅ vibe initialized (v${packageJson.version})
${formatLLMStatus()}
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

      execSync(`vibe update${options.silent ? ' --silent' : ''}`, {
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

    // 최신 버전 확인
    if (!options.silent) {
      const wasUpgraded = await checkAndUpgradeVibe();
      if (wasUpgraded) return;
    }

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

    // 전역 vibe 패키지 먼저 설치 (~/.config/vibe/) - hooks에서 참조함
    installGlobalVibePackage(true);

    // 전역 assets 업데이트 (hooks가 위에서 설치된 패키지 참조)
    installGlobalAssets(true);

    // 프로젝트 로컬 자산 제거
    removeLocalAssets(claudeDir);

    // .gitignore 업데이트
    updateGitignore(projectRoot);

    // 협업자 자동 설치 설정
    setupCollaboratorAutoInstall(projectRoot);

    // ~/.claude.json 정리
    cleanupClaudeConfig();

    // MCP 서버 등록
    registerMcpServers(true);

    // 레거시 mcp 폴더 정리
    cleanupLegacyMcp(vibeDir);

    const packageJson = getPackageJson();
    log(`✅ vibe updated (v${packageJson.version})\n${formatLLMStatus()}`);

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

  // MCP 서버 제거
  unregisterMcp('vibe');
  unregisterMcp('vibe-gemini');
  unregisterMcp('vibe-gpt');
  unregisterMcp('context7');
  console.log('   ✅ MCP server removed\n');

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

Basic Commands:
  vibe init [project]     Initialize project
  vibe update             Update settings
  vibe status             Show current status
  vibe help               Help
  vibe version            Version info

External LLM Auth:
  vibe auth gpt           GPT Plus/Pro OAuth authentication
  vibe auth gemini        Gemini subscription OAuth (recommended)
  vibe auth gpt --key <key>       GPT API key setup
  vibe auth gemini --key <key>    Gemini API key setup

Status & Management:
  vibe status             Full status check
  vibe status gpt         GPT auth status
  vibe status gemini      Gemini auth status
  vibe logout gpt         GPT logout
  vibe logout gemini      Gemini logout
  vibe remove gpt         Remove GPT
  vibe remove gemini      Remove Gemini
  vibe remove             Remove vibe entirely (MCP, settings, package)

Claude Code Slash Commands:
  /vibe.spec "feature"    Create SPEC (PTCF structure) + parallel research
  /vibe.run "feature"     Execute implementation
  /vibe.run ... ultrawork Maximum performance mode
  /vibe.verify "feature"  BDD verification
  /vibe.review            Parallel code review (13+ agents)
  /vibe.reason "problem"  Systematic reasoning
  /vibe.analyze           Project analysis
  /vibe.utils             Utilities (--e2e, --diagram, --continue)

Hook-based LLM Routing (Auto):
  "architecture/design" → GPT auto-routing
  "UI/UX/design"        → Gemini auto-routing
  "debugging/bug"       → GPT auto-routing
  "code analysis"       → Gemini auto-routing

Direct LLM Call:
  gpt. / gpt-           GPT direct call (with web search)
  gemini. / gemini-     Gemini direct call (with web search)

Workflow:
  /vibe.spec → /vibe.run → /vibe.verify

Docs:
  https://github.com/su-record/vibe
  `);
}

function showStatus(): void {
  const projectRoot = process.cwd();
  const vibeDir = path.join(projectRoot, '.claude', 'vibe');
  const configPath = path.join(vibeDir, 'config.json');

  if (!fs.existsSync(vibeDir)) {
    console.log('❌ Not a vibe project. Run vibe init first.');
    return;
  }

  const packageJson = getPackageJson();
  let config: VibeConfig = { language: 'ko', models: {} };
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  // 실제 OAuth 인증 상태 확인
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

  console.log(`
📊 Vibe Status (v${packageJson.version})

Project: ${projectRoot}
Language: ${config.language || 'ko'}

Models:
  Opus 4.5          Orchestrator
  Sonnet 4          Implementation
  Haiku 4.5         Code exploration
  GPT 5.2           ${gptStatusText}
  Gemini 3          ${geminiStatusText}

MCP:
  context7          Library docs search

GPT/Gemini (Hook-based):
  - "gpt.question" → GPT with web search
  - "gemini.question" → Gemini call

LLM setup:
  vibe auth gpt           Enable GPT (OAuth)
  vibe auth gemini        Enable Gemini (OAuth)
  vibe logout gpt         GPT logout
  vibe logout gemini      Gemini logout
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

export { createThinkingChain } from '../tools/thinking/createThinkingChain.js';
export { analyzeProblem } from '../tools/thinking/analyzeProblem.js';
export { stepByStepAnalysis } from '../tools/thinking/stepByStepAnalysis.js';
export { formatAsPlan } from '../tools/thinking/formatAsPlan.js';
export { breakDownProblem } from '../tools/thinking/breakDownProblem.js';
export { thinkAloudProcess } from '../tools/thinking/thinkAloudProcess.js';

export { generatePrd } from '../tools/planning/generatePrd.js';
export { createUserStories } from '../tools/planning/createUserStories.js';
export { analyzeRequirements } from '../tools/planning/analyzeRequirements.js';
export { featureRoadmap } from '../tools/planning/featureRoadmap.js';

export { enhancePrompt } from '../tools/prompt/enhancePrompt.js';
export { analyzePrompt } from '../tools/prompt/analyzePrompt.js';

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
    if (positionalArgs[1] === 'gpt' || positionalArgs[1] === 'gemini') {
      removeExternalLLM(positionalArgs[1]);
    } else {
      remove();
    }
    break;

  case 'auth':
    if (positionalArgs[1] === 'gpt') {
      const keyIndex = args.indexOf('--key');
      if (keyIndex !== -1 && args[keyIndex + 1]) {
        setupExternalLLM('gpt', args[keyIndex + 1]);
      } else {
        gptAuth();
      }
    } else if (positionalArgs[1] === 'gemini') {
      const keyIndex = args.indexOf('--key');
      if (keyIndex !== -1 && args[keyIndex + 1]) {
        setupExternalLLM('gemini', args[keyIndex + 1]);
      } else {
        geminiAuth();
      }
    } else {
      showAuthHelp();
    }
    break;

  case 'logout':
    if (positionalArgs[1] === 'gpt') {
      gptLogout();
    } else if (positionalArgs[1] === 'gemini') {
      geminiLogout();
    } else {
      showLogoutHelp();
    }
    break;

  case 'status':
    if (positionalArgs[1] === 'gpt') {
      gptStatus();
    } else if (positionalArgs[1] === 'gemini') {
      geminiStatus();
    } else {
      showStatus();
    }
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
  vibe init       Initialize project
  vibe update     Update settings
  vibe auth       LLM auth (gpt, gemini)
  vibe status     Show status
  vibe logout     Logout
  vibe remove     Remove
  vibe help       Help
  vibe version    Version info

Usage: vibe help
    `);
    process.exit(1);
}
