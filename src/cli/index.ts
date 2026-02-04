#!/usr/bin/env node

/**
 * core CLI (TypeScript version 2.0)
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
  migrateLegacyCore,
  updateGitignore,
  updateConfig,
  cleanupLegacy,
  removeLocalAssets,
  cleanupClaudeConfig,
  cleanupLegacyMcp,
  installProjectHooks,
  installCursorRules,
} from './setup.js';
import {
  showHud,
  startHud,
  updateHudPhase,
  manageHudAgent,
  updateHudContext,
  resetHud,
  showHudHelp,
} from './hud.js';
import {
  installCursorAgents,
  generateCursorRules,
  generateCursorSkills,
  getCoreConfigDir,
} from './postinstall.js';

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
// Helper Functions
// ============================================================================

/**
 * Update global Cursor assets (agents, rules, skills)
 * Called by both su init and su update
 * @param detectedStacks - 감지된 기술 스택 배열 (예: ['typescript-react', 'python-fastapi'])
 */
function updateCursorGlobalAssets(detectedStacks: string[] = []): void {
  try {
    const packageRoot = path.resolve(__dirname, '..', '..');
    const agentsSource = path.join(packageRoot, 'agents');

    // VIBE 언어 룰 디렉토리 (~/.claude/core/languages/ 또는 패키지 내 languages/)
    const globalLanguagesDir = path.join(os.homedir(), '.claude', 'core', 'languages');
    const packageLanguagesDir = path.join(packageRoot, 'languages');
    const languagesDir = fs.existsSync(globalLanguagesDir) ? globalLanguagesDir : packageLanguagesDir;

    // 1. Cursor agents (12 reviewers)
    const cursorAgentsDir = path.join(os.homedir(), '.cursor', 'agents');
    if (fs.existsSync(agentsSource)) {
      installCursorAgents(agentsSource, cursorAgentsDir);
    }

    // 2. Cursor rules template (VIBE 언어 룰 기반 + 공통 룰)
    const cursorRulesTemplateDir = path.join(os.homedir(), '.cursor', 'rules-template');
    generateCursorRules(cursorRulesTemplateDir, detectedStacks, languagesDir);

    // 3. Cursor skills (7 VIBE skills)
    const cursorSkillsDir = path.join(os.homedir(), '.cursor', 'skills');
    generateCursorSkills(cursorSkillsDir);

  } catch (err) {
    // Non-critical - don't fail init/update
    if (!options.silent) {
      console.warn(`   ⚠️ Cursor assets update warning: ${(err as Error).message}`);
    }
  }
}

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
    const coreDir = path.join(claudeDir, 'core');
    if (fs.existsSync(coreDir)) {
      log('❌ .claude/core/ already exists.');
      return;
    }

    ensureDir(coreDir);

    // 레거시 마이그레이션
    migrateLegacyCore(projectRoot, coreDir);

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
    updateConstitution(coreDir, detectedStacks, stackDetails);

    // config.json 생성
    updateConfig(coreDir, detectedStacks, stackDetails, false);

    // CLAUDE.md 병합
    updateClaudeMd(projectRoot, detectedStacks, false);

    // 규칙 복사
    updateRules(coreDir, detectedStacks, false);

    // 협업자 자동 설치 설정
    setupCollaboratorAutoInstall(projectRoot);

    // 프로젝트 레벨 훅 설치
    installProjectHooks(projectRoot);

    // Cursor 글로벌 에셋 업데이트 (agents, skills, rules-template) - 먼저 실행!
    const stackTypes = detectedStacks.map(s => s.type);
    updateCursorGlobalAssets(stackTypes);

    // Cursor IDE 룰 설치 (프로젝트 레벨) - rules-template 생성 후 현재 스택에 해당하는 룰만 복사
    installCursorRules(projectRoot, stackTypes);

    // 완료 메시지
    const packageJson = getPackageJson();

    log(`✅ su initialized (v${packageJson.version})
${formatLLMStatus()}
📦 Context7 plugin (recommended): /plugin install context7

Next: ${isNewProject ? `cd ${projectName} && ` : ''}/su.spec "feature"
`);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Init failed:', message);
    process.exit(1);
  }
}

async function checkAndUpgradeVibe(): Promise<boolean> {
  try {
    log(`⬆️ Upgrading from git...\n`);

    execSync('npm install -g git+https://github.com/su-record/core.git', {
      stdio: options.silent ? 'pipe' : 'inherit'
    });

    // 업그레이드 완료 후 새 버전으로 설정 업데이트 (--skip-upgrade로 무한 루프 방지)
    execSync(`su update --skip-upgrade${options.silent ? ' --silent' : ''}`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    return true;
  } catch { /* ignore: optional operation */
    return false;
  }
}

async function update(): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const coreDir = path.join(projectRoot, '.claude', 'core');
    const claudeDir = path.join(projectRoot, '.claude');
    const legacyCoreDir = path.join(projectRoot, '.core');

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
    if (fs.existsSync(legacyCoreDir) && !fs.existsSync(coreDir)) {
      migrateLegacyCore(projectRoot, coreDir);
    }

    if (!fs.existsSync(coreDir) && !fs.existsSync(legacyCoreDir)) {
      // 프로젝트가 없어도 전역 업그레이드는 완료됨
      const packageJson = getPackageJson();
      log(`✅ core global updated (v${packageJson.version})
${formatLLMStatus()}
`);
      return;
    }

    ensureDir(coreDir);

    // 레거시 정리
    cleanupLegacy(projectRoot, claudeDir);

    // 기술 스택 감지
    const { stacks: detectedStacks, details: stackDetails } = detectTechStacks(projectRoot);

    // config.json 업데이트
    updateConfig(coreDir, detectedStacks, stackDetails, true);

    // constitution.md 업데이트
    updateConstitution(coreDir, detectedStacks, stackDetails);

    // CLAUDE.md 업데이트
    updateClaudeMd(projectRoot, detectedStacks, true);

    // 규칙 업데이트
    updateRules(coreDir, detectedStacks, true);

    // 프로젝트 로컬 자산 제거
    removeLocalAssets(claudeDir);

    // .gitignore 업데이트
    updateGitignore(projectRoot);

    // 협업자 자동 설치 설정
    setupCollaboratorAutoInstall(projectRoot);

    // 프로젝트 레벨 훅 설치
    installProjectHooks(projectRoot);

    // Cursor 글로벌 에셋 업데이트 (agents, skills, rules-template) - 먼저 실행!
    const stackTypes = detectedStacks.map(s => s.type);
    updateCursorGlobalAssets(stackTypes);

    // Cursor IDE 룰 설치/업데이트 (프로젝트 레벨) - rules-template 생성 후 현재 스택에 해당하는 룰만 복사
    installCursorRules(projectRoot, stackTypes);

    // ~/.claude.json 정리
    cleanupClaudeConfig();

    // 레거시 mcp 폴더 정리
    cleanupLegacyMcp(coreDir);

    const packageJson = getPackageJson();

    log(`✅ su updated (v${packageJson.version})
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
  const coreDir = path.join(projectRoot, '.claude', 'core');
  const legacyCoreDir = path.join(projectRoot, '.core');
  const claudeDir = path.join(projectRoot, '.claude');

  if (!fs.existsSync(coreDir) && !fs.existsSync(legacyCoreDir)) {
    console.log('❌ Not a core project.');
    return;
  }

  console.log('🗑️  Removing core...\n');


  // .claude/core 폴더 제거
  if (fs.existsSync(coreDir)) {
    removeDirRecursive(coreDir);
    console.log('   ✅ .claude/core/ removed\n');
  }

  // 레거시 .core 폴더도 제거
  if (fs.existsSync(legacyCoreDir)) {
    removeDirRecursive(legacyCoreDir);
    console.log('   ✅ .core/ removed (legacy)\n');
  }

  // .claude/commands 제거
  const commandsDir = path.join(claudeDir, 'commands');
  if (fs.existsSync(commandsDir)) {
    const coreCommands = ['core.spec.md', 'core.run.md', 'core.verify.md', 'core.reason.md', 'core.analyze.md', 'core.ui.md', 'core.diagram.md'];
    coreCommands.forEach(cmd => {
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
    const coreAgents = ['simplifier.md', 'explorer.md', 'implementer.md', 'tester.md', 'searcher.md'];
    coreAgents.forEach(agent => {
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

  // Cursor 글로벌 에셋 제거
  const cursorDir = path.join(os.homedir(), '.cursor');

  // Cursor agents 제거 (12 reviewers)
  const cursorAgentsDir = path.join(cursorDir, 'agents');
  if (fs.existsSync(cursorAgentsDir)) {
    const coreReviewers = [
      'security-reviewer.md', 'architecture-reviewer.md', 'data-integrity-reviewer.md',
      'typescript-reviewer.md', 'python-reviewer.md', 'react-reviewer.md', 'rails-reviewer.md',
      'performance-reviewer.md', 'complexity-reviewer.md', 'simplicity-reviewer.md',
      'test-coverage-reviewer.md', 'git-history-reviewer.md'
    ];
    let removedAgents = 0;
    coreReviewers.forEach(agent => {
      const agentPath = path.join(cursorAgentsDir, agent);
      if (fs.existsSync(agentPath)) {
        fs.unlinkSync(agentPath);
        removedAgents++;
      }
    });
    if (removedAgents > 0) {
      console.log(`   ✅ Cursor agents removed (${removedAgents})\n`);
    }
  }

  // Cursor skills 제거 (7 core skills)
  const cursorSkillsDir = path.join(cursorDir, 'skills');
  if (fs.existsSync(cursorSkillsDir)) {
    const coreSkills = ['su-spec', 'su-run', 'su-review', 'su-analyze', 'su-verify', 'su-reason', 'su-ui'];
    let removedSkills = 0;
    coreSkills.forEach(skill => {
      const skillDir = path.join(cursorSkillsDir, skill);
      if (fs.existsSync(skillDir)) {
        removeDirRecursive(skillDir);
        removedSkills++;
      }
    });
    if (removedSkills > 0) {
      console.log(`   ✅ Cursor skills removed (${removedSkills})\n`);
    }
  }

  // Cursor rules template 제거 (5 rules)
  const cursorRulesDir = path.join(cursorDir, 'rules-template');
  if (fs.existsSync(cursorRulesDir)) {
    const coreRules = [
      'typescript-standards.mdc', 'react-patterns.mdc', 'code-quality.mdc',
      'security-checklist.mdc', 'python-standards.mdc'
    ];
    let removedRules = 0;
    coreRules.forEach(rule => {
      const rulePath = path.join(cursorRulesDir, rule);
      if (fs.existsSync(rulePath)) {
        fs.unlinkSync(rulePath);
        removedRules++;
      }
    });
    if (removedRules > 0) {
      console.log(`   ✅ Cursor rules template removed (${removedRules})\n`);
    }
  }

  console.log(`
✅ su removed!

Removed:
  - MCP server (context7)
  - .claude/core/ folder
  - Slash commands (7)
  - Subagents (5)
  - Hooks settings
  - Cursor agents (12)
  - Cursor skills (7)
  - Cursor rules template (5)

To reinstall: su init
  `);
}

// ============================================================================
// Info Commands
// ============================================================================

function showHelp(): void {
  console.log(`
📖 Core - SPEC-driven AI coding framework (Claude Code exclusive)

Commands:
  su init [project]     Initialize project
  su update             Update settings
  su status             Show status
  core hud [subcommand]   HUD status display
  su help               Help
  su version            Version

GPT:
  su gpt auth           OAuth authentication (Plus/Pro)
  su gpt key <KEY>      Set API key
  su gpt status         Check status
  su gpt logout         Logout
  su gpt remove         Remove config

Gemini:
  su gemini auth        OAuth authentication
  su gemini key <KEY>   Set API key
  su gemini status      Check status
  su gemini logout      Logout
  su gemini remove      Remove config

Slash Commands (Claude Code):
  /su.spec "feature"    Create SPEC + parallel research
  /su.run "feature"     Execute implementation
  /su.verify "feature"  BDD verification
  /su.review            Parallel code review (13+ agents)
  /su.reason "problem"  Systematic reasoning
  /su.analyze           Project analysis
  /su.utils             Utilities (--e2e, --diagram, --continue)

Workflow:
  /su.spec "feature" ultrawork    Full automation (SPEC→Review→Implement)
  /su.spec → /su.run            Manual step-by-step

Docs: https://github.com/su-record/core
  `);
}

function showStatus(): void {
  const projectRoot = process.cwd();
  const coreDir = path.join(projectRoot, '.claude', 'core');
  const configPath = path.join(coreDir, 'config.json');

  const packageJson = getPackageJson();
  const isCoreProject = fs.existsSync(coreDir);

  let config: VibeConfig = { language: 'ko', models: {} };
  if (isCoreProject && fs.existsSync(configPath)) {
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
  const projectStatus = isCoreProject
    ? `✅ ${projectRoot}`
    : `⬚ Not a core project (run: su init)`;

  console.log(`
📊 Core Status (v${packageJson.version})

Project: ${projectStatus}
${isCoreProject ? `Language: ${config.language || 'ko'}` : ''}

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
  console.log(`core v${packageJson.version}`);
}

// ============================================================================
// Tool Exports (for slash commands)
// ============================================================================

export * from '../lib/MemoryManager.js';
export * from '../lib/ProjectCache.js';
export * from '../lib/ContextCompressor.js';
export * from '../lib/ProgressTracker.js';

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

  // su gpt <subcommand>
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
          console.log('Usage: su gpt key <API_KEY>');
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
  su gpt auth     OAuth authentication (Plus/Pro)
  su gpt key      Set API key
  su gpt status   Check status
  su gpt logout   Logout
  su gpt remove   Remove config
        `);
    }
    break;
  }

  // su gemini <subcommand>
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
          console.log('Usage: su gemini key <API_KEY>');
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
  su gemini auth     OAuth authentication
  su gemini key      Set API key
  su gemini status   Check status
  su gemini logout   Logout
  su gemini remove   Remove config
        `);
    }
    break;
  }

  case 'status':
    showStatus();
    break;

  // core hud <subcommand>
  case 'hud': {
    const subCommand = positionalArgs[1];
    switch (subCommand) {
      case 'show':
        showHud(positionalArgs[2] || 'focused');
        break;
      case 'start':
        startHud(positionalArgs[2] || 'ultrawork', positionalArgs[3]);
        break;
      case 'phase': {
        const current = parseInt(positionalArgs[2], 10) || 1;
        const total = parseInt(positionalArgs[3], 10) || current;
        const phaseName = positionalArgs.slice(4).join(' ') || undefined;
        updateHudPhase(current, total, phaseName);
        break;
      }
      case 'agent': {
        const action = positionalArgs[2] as 'add' | 'remove' | 'clear';
        if (action === 'add') {
          manageHudAgent('add', positionalArgs[3], positionalArgs[4]);
        } else if (action === 'remove') {
          manageHudAgent('remove', positionalArgs[3]);
        } else if (action === 'clear') {
          manageHudAgent('clear');
        } else {
          console.log(`
Agent Commands:
  core hud agent add <name> [model]  Add agent (default: sonnet)
  core hud agent remove <name>       Remove agent
  core hud agent clear               Clear all agents
          `);
        }
        break;
      }
      case 'context': {
        const used = parseInt(positionalArgs[2], 10) || 0;
        const total = parseInt(positionalArgs[3], 10) || 200000;
        updateHudContext(used, total);
        break;
      }
      case 'reset':
      case 'done':
        resetHud();
        break;
      case 'help':
        showHudHelp();
        break;
      case undefined:
        // No subcommand: show focused status by default
        showHud('focused');
        break;
      default:
        showHudHelp();
    }
    break;
  }

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
  su init         Initialize project
  su update       Update settings
  core hud <cmd>    HUD status (show, start, phase, agent, reset)
  su gpt <cmd>    GPT commands (auth, key, status, logout)
  su gemini <cmd> Gemini commands (auth, key, status, logout)
  su status       Show status
  su remove       Remove core
  su help         Help
  su version      Version info

Usage: su help
    `);
    process.exit(1);
}
