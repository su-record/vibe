#!/usr/bin/env node

/**
 * core CLI (TypeScript version 2.0)
 * SPEC-driven AI coding framework (Claude Code exclusive)
 *
 * v0.0.4: 명령어 관심사 분리
 * - commands/init: init 명령어
 * - commands/update: update 명령어
 * - commands/remove: remove 명령어
 * - commands/info: help, status, version
 */

import { CliOptions } from './types.js';
import { setSilentMode } from './utils.js';
import {
  setupExternalLLM,
  removeExternalLLM,
  gptAuth,
  gptStatus,
  gptLogout,
  geminiAuth,
  geminiStatus,
  geminiLogout,
} from './llm.js';
import {
  showHud,
  startHud,
  updateHudPhase,
  manageHudAgent,
  updateHudContext,
  resetHud,
  showHudHelp,
} from './hud.js';
import { init, update, remove, showHelp, showStatus, showVersion } from './commands/index.js';

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
    update(options, skipUpgrade);
    break;

  case 'remove':
  case 'uninstall':
    remove();
    break;

  // su-core gpt <subcommand>
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
          console.log('Usage: su-core gpt key <API_KEY>');
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
  su-core gpt auth     OAuth authentication (Plus/Pro)
  su-core gpt key      Set API key
  su-core gpt status   Check status
  su-core gpt logout   Logout
  su-core gpt remove   Remove config
        `);
    }
    break;
  }

  // su-core gemini <subcommand>
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
          console.log('Usage: su-core gemini key <API_KEY>');
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
  su-core gemini auth     OAuth authentication
  su-core gemini key      Set API key
  su-core gemini status   Check status
  su-core gemini logout   Logout
  su-core gemini remove   Remove config
        `);
    }
    break;
  }

  case 'status':
    showStatus();
    break;

  // su-core hud <subcommand>
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
  su-core hud agent add <name> [model]  Add agent (default: sonnet)
  su-core hud agent remove <name>       Remove agent
  su-core hud agent clear               Clear all agents
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
  su-core init         Initialize project
  su-core update       Update settings
  su-core hud <cmd>    HUD status (show, start, phase, agent, reset)
  su-core gpt <cmd>    GPT commands (auth, key, status, logout)
  su-core gemini <cmd> Gemini commands (auth, key, status, logout)
  su-core status       Show status
  su-core remove       Remove core
  su-core help         Help
  su-core version      Version info

Usage: su-core help
    `);
    process.exit(1);
}
