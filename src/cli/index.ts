#!/usr/bin/env node

/**
 * core CLI — SPEC-driven AI coding framework (Claude Code exclusive)
 */

import fs from 'fs';
import path from 'path';

import { CliOptions } from './types.js';
import { setSilentMode } from './utils.js';
import {
  setupExternalLLM,
  removeExternalLLM,
  gptStatus,
  gptLogout,
  geminiAuth,
  geminiStatus,
  geminiLogout,
  claudeStatus,
  claudeLogout,
} from './llm.js';
import { patchGlobalConfig, getVibeDir } from '../infra/lib/config/GlobalConfigManager.js';
import type { GlobalVibeConfig } from './types.js';
import {
  init, setup, update, upgrade, remove, showHelp, showStatus, showVersion,
  telegramSetup, telegramChat, telegramStatus, telegramHelp,
  slackSetup, slackChannel, slackStatus, slackHelp,
  skillsAdd,
  figmaSetup, figmaStatus, figmaLogout, figmaBreakpoints, figmaHelp,
} from './commands/index.js';

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
// Tool Exports (for slash commands)
// ============================================================================

export * from '../infra/lib/MemoryManager.js';
export * from '../infra/lib/ProjectCache.js';
export * from '../infra/lib/ContextCompressor.js';
export {
  PhaseInfo,
  ProgressState,
  getProgressPath,
  loadProgress,
  saveProgress,
  initProgress,
  updatePhase,
  completeTask,
  recordCommit,
  incrementSession,
  formatProgressState,
  getProgressSummary,
  writeProgressText,
} from '../infra/lib/IterationTracker.js';

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

  case 'setup':
    (async () => {
      await setup();
    })();
    break;

  case 'update':
    update(options);
    break;

  case 'upgrade':
    upgrade(options);
    break;

  case 'remove':
  case 'uninstall':
    remove();
    break;

  // vibe claude <subcommand>
  case 'claude': {
    const subCommand = positionalArgs[1];
    switch (subCommand) {
      case 'key': {
        const apiKey = positionalArgs[2] || args.find(a => !a.startsWith('-') && a !== 'claude' && a !== 'key');
        if (apiKey) {
          setupExternalLLM('claude', apiKey);
        } else {
          console.log('Usage: vibe claude key <ANTHROPIC_API_KEY>');
        }
        break;
      }
      case 'logout':
      case 'remove':
        claudeLogout();
        break;
      case 'status':
        claudeStatus();
        break;
      default:
        console.log(`
Claude Commands:
  vibe claude key <key>     Set Anthropic API key
  vibe claude status        Check status
  vibe claude logout        Remove key

Get key: https://console.anthropic.com/settings/keys
        `);
    }
    break;
  }

  // vibe gpt <subcommand>
  case 'gpt': {
    const subCommand = positionalArgs[1];
    switch (subCommand) {
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
      case 'remove':
        gptLogout();
        break;
      case 'status':
        gptStatus();
        break;
      default:
        console.log(`
GPT Commands:
  vibe gpt key <key>     Set OpenAI API key (for embeddings)
  vibe gpt status        Check status (Codex CLI + API key)
  vibe gpt logout        Remove API key

Text generation: codex exec (via Codex CLI)
Embeddings: OpenAI API (requires API key)
Codex auth: codex auth
        `);
    }
    break;
  }

  // vibe gemini <subcommand>
  case 'gemini': {
    const subCommand = positionalArgs[1];
    switch (subCommand) {
      case 'auth':
        await geminiAuth();
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
  vibe gemini auth                 Detect Gemini CLI credentials
  vibe gemini key <key>            Set API key
  vibe gemini status               Check status
  vibe gemini logout               Clear config
  vibe gemini remove               Remove config

Auth order: gemini-cli → apikey
Requires: npm i -g @google/gemini-cli && gemini
        `);
    }
    break;
  }

  // vibe skills <subcommand>
  case 'skills': {
    const skillsSub = positionalArgs[1];
    switch (skillsSub) {
      case 'add':
        skillsAdd(positionalArgs[2]);
        break;
      default:
        console.log(`
Skills Commands:
  vibe skills add <owner/repo>  Install skill from skills.sh

Example: vibe skills add vercel-labs/skills
        `);
    }
    break;
  }

  case 'status':
    showStatus();
    break;

  // vibe telegram <subcommand>
  case 'telegram': {
    const telegramSub = positionalArgs[1];
    switch (telegramSub) {
      case 'setup':
        telegramSetup(positionalArgs[2]);
        break;
      case 'chat':
        telegramChat(positionalArgs[2]);
        break;
      case 'status':
        telegramStatus();
        break;
      case 'help':
        telegramHelp();
        break;
      default:
        telegramHelp();
    }
    break;
  }

  // vibe slack <subcommand>
  case 'slack': {
    const slackSub = positionalArgs[1];
    switch (slackSub) {
      case 'setup':
        slackSetup(positionalArgs[2], positionalArgs[3]);
        break;
      case 'channel':
        slackChannel(positionalArgs[2]);
        break;
      case 'status':
        slackStatus();
        break;
      case 'help':
        slackHelp();
        break;
      default:
        slackHelp();
    }
    break;
  }

  // vibe figma <subcommand>
  case 'figma': {
    const figmaSub = positionalArgs[1];
    switch (figmaSub) {
      case 'setup':
        figmaSetup(positionalArgs[2]);
        break;
      case 'breakpoints': {
        const setFlag = args.indexOf('--set');
        figmaBreakpoints(setFlag >= 0 ? args[setFlag + 1] : undefined);
        break;
      }
      case 'status':
        figmaStatus();
        break;
      case 'logout':
      case 'remove':
        figmaLogout();
        break;
      case 'help':
        figmaHelp();
        break;
      default:
        figmaHelp();
    }
    break;
  }

  // vibe env import [path]
  case 'env': {
    const envSub = positionalArgs[1];
    if (envSub === 'import') {
      const envSource = positionalArgs[2] || path.join(process.cwd(), '.env');
      if (!fs.existsSync(envSource)) {
        console.error(`File not found: ${envSource}`);
        process.exit(1);
      }
      const envContent = fs.readFileSync(envSource, 'utf-8');
      const ENV_TO_CONFIG: Record<string, (v: string, p: Partial<GlobalVibeConfig>) => void> = {
        FIGMA_ACCESS_TOKEN: (v, p) => { (p.credentials ??= {}).figma = { ...(p.credentials.figma ?? {}), accessToken: v }; },
        OPENAI_API_KEY: (v, p) => { (p.credentials ??= {}).gpt = { ...(p.credentials.gpt ?? {}), apiKey: v }; },
        GEMINI_API_KEY: (v, p) => { (p.credentials ??= {}).gemini = { ...(p.credentials.gemini ?? {}), apiKey: v }; },
        TELEGRAM_BOT_TOKEN: (v, p) => { (p.channels ??= {}).telegram = { ...(p.channels.telegram ?? {}), botToken: v }; },
        TELEGRAM_ALLOWED_CHAT_IDS: (v, p) => { (p.channels ??= {}).telegram = { ...(p.channels.telegram ?? {}), allowedChatIds: v.split(',').map(s => s.trim()) }; },
        SLACK_BOT_TOKEN: (v, p) => { (p.channels ??= {}).slack = { ...(p.channels.slack ?? {}), botToken: v }; },
        SLACK_APP_TOKEN: (v, p) => { (p.channels ??= {}).slack = { ...(p.channels.slack ?? {}), appToken: v }; },
        SLACK_ALLOWED_CHANNELS: (v, p) => { (p.channels ??= {}).slack = { ...(p.channels.slack ?? {}), allowedChannelIds: v.split(',').map(s => s.trim()) }; },
        GPT_MODEL: (v, p) => { (p.models ??= {}).gpt = v; },
        GEMINI_MODEL: (v, p) => { (p.models ??= {}).gemini = v; },
        GEMINI_FLASH_MODEL: (v, p) => { (p.models ??= {}).geminiFlash = v; },
        GEMINI_SEARCH_MODEL: (v, p) => { (p.models ??= {}).geminiSearch = v; },
        CLAUDE_BACKGROUND_MODEL: (v, p) => { (p.models ??= {}).claudeBackground = v; },
        CLAUDE_RESEARCH_MODEL: (v, p) => { (p.models ??= {}).claudeResearch = v; },
        CLAUDE_REVIEW_MODEL: (v, p) => { (p.models ??= {}).claudeReview = v; },
        CLAUDE_ARCHITECTURE_MODEL: (v, p) => { (p.models ??= {}).claudeArchitecture = v; },
        EMBEDDING_MODEL: (v, p) => { (p.models ??= {}).embedding = v; },
        GEMINI_EMBEDDING_MODEL: (v, p) => { (p.models ??= {}).geminiEmbedding = v; },
        WORKSPACE_DIR: (v, p) => { (p.settings ??= {}).workspaceDir = v; },
      };
      const patch: Partial<GlobalVibeConfig> = {};
      let count = 0;
      let skipped = 0;
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (!val.startsWith('"') && !val.startsWith("'")) {
          const hashIdx = val.indexOf('#');
          if (hashIdx > 0) val = val.slice(0, hashIdx).trim();
        }
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!key || !val) continue;
        const mapper = ENV_TO_CONFIG[key];
        if (mapper) {
          mapper(val, patch);
          count++;
        } else {
          skipped++;
        }
      }
      if (count > 0) {
        patchGlobalConfig(patch);
      }
      const configPath = path.join(getVibeDir(), 'config.json');
      console.log(`\n${count} variables imported to ${configPath}`);
      if (skipped > 0) {
        console.log(`${skipped} unknown variables skipped`);
      }
      console.log('');
    } else {
      console.log(`
Env Commands:
  vibe env import [path]  .env 파일을 ~/.vibe/config.json으로 가져오기
                          path 생략 시 현재 디렉토리의 .env 사용
      `);
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
  vibe setup              셋업 위자드
  vibe upgrade            최신 버전으로 업그레이드
  vibe update             프로젝트 설정 업데이트
  vibe status             전체 상태 확인
  vibe claude <cmd>       Claude (key, status, logout)
  vibe gpt <cmd>          GPT (auth, key, status, logout)
  vibe gemini <cmd>       Gemini (auth, key, status, logout)

  vibe figma <cmd>        Figma (setup, extract, status, logout)
  vibe telegram <cmd>     Telegram (setup, status) - notification only
  vibe slack <cmd>        Slack (setup, status) - notification only

Usage: vibe help
    `);
    process.exit(1);
}
