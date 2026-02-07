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
  setupAzureConfig,
  setupAzureFromCli,
  removeAzureConfig,
  gptAuth,
  gptStatus,
  gptLogout,
  geminiAuth,
  geminiStatus,
  geminiLogout,
  geminiImport,
  azStatus,
  azLogout,
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
import { init, update, remove, showHelp, showStatus, showVersion, syncLogin, syncPush, syncPull, syncStatus, syncLogout, daemonStart, daemonStop, daemonStatus, daemonRestart, daemonHelp, jobList, jobStatus, jobCancel, jobHelp, policyList, policyEnable, policyDisable, policySet, policyHelp, telegramSetup, telegramChat, telegramStart, telegramStop, telegramStatus, telegramHelp, interfaceList, interfaceEnable, interfaceDisable, interfaceHelp, webhookAdd, webhookList, webhookRemove, webhookHelp, deviceList, deviceRename, deviceRemove, deviceHelp } from './commands/index.js';

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
      case 'azure': {
        const hasManualArgs = args.includes('--endpoint') || args.includes('--key') || args.includes('--deployment');
        if (hasManualArgs) {
          const endpoint = args[args.indexOf('--endpoint') + 1] || '';
          const azureKey = args[args.indexOf('--key') + 1] || '';
          const deployment = args[args.indexOf('--deployment') + 1] || '';
          const apiVersion = args.includes('--api-version') ? args[args.indexOf('--api-version') + 1] : undefined;
          setupAzureConfig(endpoint, azureKey, deployment, apiVersion);
        } else {
          // 인자 없으면 az CLI 자동 탐지
          setupAzureFromCli();
        }
        break;
      }
      case 'azure-remove':
        removeAzureConfig();
        break;
      case 'status':
        gptStatus();
        break;
      default:
        console.log(`
GPT Commands:
  vibe gpt auth                    OAuth authentication (Plus/Pro)
  vibe gpt key <key>               Set API key
  vibe gpt azure --endpoint <url> --key <key> --deployment <name>
                                   Set Azure OpenAI (auto-detect if no args)
  vibe gpt azure-remove            Remove Azure config
  vibe gpt status                  Check status
  vibe gpt logout                  Logout
  vibe gpt remove                  Remove config

Auth order: oauth → apikey → azure
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
      case 'import':
        geminiImport();
        break;
      default:
        console.log(`
Gemini Commands:
  vibe gemini auth                 OAuth authentication
  vibe gemini key <key>            Set API key
  vibe gemini import               Import Gemini CLI credentials
  vibe gemini status               Check status
  vibe gemini logout               Logout
  vibe gemini remove               Remove config

Auth order: oauth → apikey → gemini-cli(auto)
        `);
    }
    break;
  }

  // vibe az <subcommand>
  case 'az': {
    const subCommand = positionalArgs[1];
    switch (subCommand) {
      case 'key': {
        const apiKey = positionalArgs[2] || args.find(a => !a.startsWith('-') && a !== 'az' && a !== 'key');
        if (apiKey) {
          setupExternalLLM('az', apiKey);
        } else {
          console.log('Usage: vibe az key <AZ_API_KEY>');
        }
        break;
      }
      case 'logout':
        azLogout();
        break;
      case 'remove':
        removeExternalLLM('az');
        break;
      case 'status':
        azStatus();
        break;
      default:
        console.log(`
AZ Commands:
  vibe az key <key>     Set Azure Foundry API key
  vibe az status        Check status & available models
  vibe az logout        Remove key
  vibe az remove        Remove config
        `);
    }
    break;
  }

  case 'status':
    showStatus();
    break;

  // vibe daemon <subcommand>
  case 'daemon': {
    const daemonSub = positionalArgs[1];
    switch (daemonSub) {
      case 'start':
        daemonStart();
        break;
      case 'stop':
        daemonStop();
        break;
      case 'status':
        daemonStatus();
        break;
      case 'restart':
        daemonRestart();
        break;
      case 'help':
        daemonHelp();
        break;
      default:
        daemonHelp();
    }
    break;
  }

  // vibe job <subcommand>
  case 'job': {
    const jobSub = positionalArgs[1];
    switch (jobSub) {
      case 'list':
        jobList();
        break;
      case 'status':
        jobStatus(positionalArgs[2]);
        break;
      case 'cancel':
        jobCancel(positionalArgs[2]);
        break;
      case 'help':
        jobHelp();
        break;
      default:
        jobHelp();
    }
    break;
  }

  // vibe policy <subcommand>
  case 'policy': {
    const policySub = positionalArgs[1];
    switch (policySub) {
      case 'list':
        policyList();
        break;
      case 'enable':
        policyEnable(positionalArgs[2]);
        break;
      case 'disable':
        policyDisable(positionalArgs[2]);
        break;
      case 'set':
        policySet(positionalArgs[2], positionalArgs[3]);
        break;
      case 'help':
        policyHelp();
        break;
      default:
        policyHelp();
    }
    break;
  }

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
      case 'start':
        telegramStart();
        break;
      case 'stop':
        telegramStop();
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

  // vibe interface <subcommand>
  case 'interface': {
    const ifaceSub = positionalArgs[1];
    switch (ifaceSub) {
      case 'list':
        interfaceList();
        break;
      case 'enable':
        interfaceEnable(positionalArgs[2]);
        break;
      case 'disable':
        interfaceDisable(positionalArgs[2]);
        break;
      case 'help':
        interfaceHelp();
        break;
      default:
        interfaceHelp();
    }
    break;
  }

  // vibe webhook <subcommand>
  case 'webhook': {
    const webhookSub = positionalArgs[1];
    switch (webhookSub) {
      case 'add':
        webhookAdd(positionalArgs[2], positionalArgs[3], positionalArgs[4]);
        break;
      case 'list':
        webhookList();
        break;
      case 'remove':
        webhookRemove(positionalArgs[2]);
        break;
      case 'help':
        webhookHelp();
        break;
      default:
        webhookHelp();
    }
    break;
  }

  // vibe device <subcommand>
  case 'device': {
    const deviceSub = positionalArgs[1];
    switch (deviceSub) {
      case 'list':
        deviceList();
        break;
      case 'rename':
        deviceRename(positionalArgs.slice(2).join(' '));
        break;
      case 'remove':
        deviceRemove(positionalArgs[2]);
        break;
      case 'help':
        deviceHelp();
        break;
      default:
        deviceHelp();
    }
    break;
  }

  // vibe sync <subcommand> (async)
  case 'sync': {
    const syncSub = positionalArgs[1];
    const onlyAuth = args.includes('--only') && args[args.indexOf('--only') + 1] === 'auth';
    const onlyMemory = args.includes('--only') && args[args.indexOf('--only') + 1] === 'memory';
    const only = onlyAuth ? 'auth' : onlyMemory ? 'memory' : undefined;
    (async () => {
      try {
        switch (syncSub) {
          case 'login':
            await syncLogin();
            break;
          case 'push':
            await syncPush(only);
            break;
          case 'pull':
            await syncPull(only);
            break;
          case 'status':
            syncStatus();
            break;
          case 'logout':
            syncLogout();
            break;
          default:
            console.log(`
vibe sync — Google Drive AppData 인증/메모리 동기화

  vibe sync login              Google 계정 연결 (1회)
  vibe sync push               현재 인증+메모리를 클라우드에 업로드
  vibe sync push --only auth   인증만 업로드
  vibe sync push --only memory 메모리만 업로드
  vibe sync pull               클라우드에서 복원
  vibe sync pull --only auth   인증만 복원
  vibe sync pull --only memory 메모리만 복원
  vibe sync status             로그인 상태 확인
  vibe sync logout             연결 해제

필요: VIBE_SYNC_GOOGLE_CLIENT_ID (Google Cloud OAuth Desktop 클라이언트)
        `);
        }
      } catch (err) {
        console.error('❌', (err as Error).message);
        process.exit(1);
      }
    })();
    break;
  }

  // vibe hud <subcommand>
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
  vibe hud agent add <name> [model]  Add agent (default: sonnet)
  vibe hud agent remove <name>       Remove agent
  vibe hud agent clear               Clear all agents
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
  vibe init         Initialize project
  vibe update       Update settings
  vibe daemon <cmd> Daemon commands (start, stop, status, restart)
  vibe job <cmd>    Job commands (list, status, cancel)
  vibe policy <cmd> Policy commands (list, enable, disable, set)
  vibe telegram <cmd> Telegram bot (setup, chat, start, stop, status)
  vibe interface <cmd> Interface management (list, enable, disable)
  vibe webhook <cmd> Webhook management (add, list, remove)
  vibe hud <cmd>    HUD status (show, start, phase, agent, reset)
  vibe gpt <cmd>    GPT commands (auth, key, status, logout)
  vibe gemini <cmd> Gemini commands (auth, key, status, logout)
  vibe az <cmd>      AZ commands (key, status, logout)
  vibe status       Show status
  vibe sync <cmd>   인증/메모리 동기화 (login, push, pull, status, logout)
  vibe device <cmd> Device management (list, rename, remove)
  vibe remove       Remove core
  vibe help         Help
  vibe version      Version info

Usage: vibe help
    `);
    process.exit(1);
}
