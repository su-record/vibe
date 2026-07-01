#!/usr/bin/env node

/**
 * core CLI — SPEC-driven AI coding framework for Claude Code, Codex, and Antigravity
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
  antigravityStatus,
  antigravityLogout,
  claudeStatus,
  claudeLogout,
  setZaiKey,
  setZaiCodingKey,
  zaiStatus,
  zaiLogout,
} from './llm.js';
import { patchGlobalConfig, getVibeDir } from '../infra/lib/config/GlobalConfigManager.js';
import type { GlobalVibeConfig } from './types.js';
import {
  init, setup, update, upgrade, remove, showHelp, showStatus, showVersion,
  telegramSetup, telegramChat, telegramStatus, telegramHelp,
  slackSetup, slackChannel, slackStatus, slackHelp,
  skillsAdd,
  figmaSetup, figmaStatus, figmaLogout, figmaBreakpoints, figmaHelp,
  configShow, configHelp,
  statsDefault, statsWeek, statsQuality, statsHelp,
  codexLaunch, codexStatus, codexShell, codexHelp,
  llmList, llmRefresh, llmHelp,
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
  case 'init': {
    let target: 'cc' | 'codex' | 'antigravity' = 'cc';
    if (args.includes('--codex')) target = 'codex';
    else if (args.includes('--antigravity')) target = 'antigravity';
    init(positionalArgs[1], target);
    break;
  }

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

  // vibe antigravity <subcommand>
  case 'antigravity':
  case 'agy': {
    const subCommand = positionalArgs[1];
    switch (subCommand) {
      case 'key': {
        const apiKey = positionalArgs[2] || args.find(a => !a.startsWith('-') && a !== command && a !== 'key');
        if (apiKey) {
          setupExternalLLM('antigravity', apiKey);
        } else {
          console.log('Usage: vibe antigravity key <API_KEY>');
        }
        break;
      }
      case 'logout':
        antigravityLogout();
        break;
      case 'remove':
        removeExternalLLM('antigravity');
        break;
      case 'status':
        antigravityStatus();
        break;
      default:
        console.log(`
Antigravity Commands:
  vibe antigravity key <key>       Set API key
  vibe antigravity status          Check status
  vibe antigravity logout          Clear config
  vibe antigravity remove          Remove config

Antigravity CLI is auto-detected through agy.
        `);
    }
    break;
  }

  // vibe llm <subcommand> — 모델 조회/최신화
  case 'llm': {
    const llmSub = positionalArgs[1];
    switch (llmSub) {
      case 'list':
        await llmList();
        break;
      case 'refresh':
      case 'sync':
        await llmRefresh();
        break;
      default:
        llmHelp();
    }
    break;
  }

  // vibe zai <subcommand>
  case 'zai':
  case 'glm': {
    const subCommand = positionalArgs[1];
    const keyArg = (): string | undefined =>
      positionalArgs[2] || args.find(a => !a.startsWith('-') && a !== command && a !== subCommand);
    switch (subCommand) {
      case 'coding-key': {
        const apiKey = keyArg();
        if (apiKey) setZaiCodingKey(apiKey);
        else console.log('Usage: vibe zai coding-key <API_KEY>');
        break;
      }
      case 'key': {
        const apiKey = keyArg();
        if (apiKey) setZaiKey(apiKey);
        else console.log('Usage: vibe zai key <API_KEY>');
        break;
      }
      case 'logout':
        zaiLogout();
        break;
      case 'status':
        zaiStatus();
        break;
      default:
        console.log(`
ZAI (Z.ai / GLM) Commands:
  vibe zai coding-key <key>   Set GLM Coding Plan key (UI/code — separate key)
  vibe zai key <key>          Set general API key (pay-as-you-go)
  vibe zai status             Check status
  vibe zai logout             Clear config

Get keys: https://z.ai  (Coding Plan has its own key)
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

  // vibe codex — Claude Code + OpenAI/Antigravity 호환 모델
  case 'codex': {
    const codexSub = positionalArgs[1];
    if (args.includes('--setup')) {
      (async () => {
        const { codexSetup } = await import('./commands/codex-proxy.js');
        await codexSetup();
      })();
    } else if (codexSub === 'shell') {
      const mIdx = args.indexOf('--model');
      codexShell(mIdx >= 0 ? args[mIdx + 1] : undefined);
    } else if (codexSub === 'status') {
      codexStatus();
    } else if (codexSub === 'help') {
      codexHelp();
    } else {
      // 모델: --model MODEL 또는 /MODEL shorthand
      let model: string | undefined;
      const mIdx = args.indexOf('--model');
      if (mIdx >= 0) model = args[mIdx + 1];
      if (codexSub?.startsWith('/')) model = codexSub.slice(1);

      const claudeArgs = args.slice(1).filter(a =>
        a !== 'codex' && a !== '--model' && a !== model && !a.startsWith('/'),
      );
      codexLaunch(model, claudeArgs);
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
        ANTIGRAVITY_API_KEY: (v, p) => { (p.credentials ??= {}).antigravity = { ...(p.credentials.antigravity ?? {}), apiKey: v }; },
        TELEGRAM_BOT_TOKEN: (v, p) => { (p.channels ??= {}).telegram = { ...(p.channels.telegram ?? {}), botToken: v }; },
        TELEGRAM_ALLOWED_CHAT_IDS: (v, p) => { (p.channels ??= {}).telegram = { ...(p.channels.telegram ?? {}), allowedChatIds: v.split(',').map(s => s.trim()) }; },
        SLACK_BOT_TOKEN: (v, p) => { (p.channels ??= {}).slack = { ...(p.channels.slack ?? {}), botToken: v }; },
        SLACK_APP_TOKEN: (v, p) => { (p.channels ??= {}).slack = { ...(p.channels.slack ?? {}), appToken: v }; },
        SLACK_ALLOWED_CHANNELS: (v, p) => { (p.channels ??= {}).slack = { ...(p.channels.slack ?? {}), allowedChannelIds: v.split(',').map(s => s.trim()) }; },
        GPT_MODEL: (v, p) => { (p.models ??= {}).gpt = v; },
        ANTIGRAVITY_MODEL: (v, p) => { (p.models ??= {}).antigravity = v; },
        CLAUDE_BACKGROUND_MODEL: (v, p) => { (p.models ??= {}).claudeBackground = v; },
        CLAUDE_RESEARCH_MODEL: (v, p) => { (p.models ??= {}).claudeResearch = v; },
        CLAUDE_REVIEW_MODEL: (v, p) => { (p.models ??= {}).claudeReview = v; },
        CLAUDE_ARCHITECTURE_MODEL: (v, p) => { (p.models ??= {}).claudeArchitecture = v; },
        EMBEDDING_MODEL: (v, p) => { (p.models ??= {}).embedding = v; },
        ANTIGRAVITY_EMBEDDING_MODEL: (v, p) => { (p.models ??= {}).antigravityEmbedding = v; },
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

  // vibe config <subcommand>
  case 'config': {
    const configSub = positionalArgs[1];
    switch (configSub) {
      case 'show':
        configShow();
        break;
      case 'help':
        configHelp();
        break;
      default:
        configShow();
    }
    break;
  }

  // vibe stats [--week|--quality|--help]
  case 'stats': {
    if (args.includes('--week')) {
      statsWeek();
    } else if (args.includes('--quality')) {
      statsQuality();
    } else if (args.includes('--help') || args.includes('-h')) {
      statsHelp();
    } else {
      statsDefault();
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
    console.log(`\n❌ Unknown command: ${command}\n\nRun 'vibe help' for available commands.\n`);
    process.exit(1);
}
