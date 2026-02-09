/**
 * 정보 명령어 (help, status, version)
 */

import path from 'path';
import fs from 'fs';
import { VibeConfig } from '../types.js';
import { getPackageJson, isSoxInstalled } from '../utils.js';
import { getLLMAuthStatus, formatAuthMethods } from '../auth.js';
import { loadSyncAuth } from '../../lib/sync/index.js';

/**
 * 도움말 표시
 */
export function showHelp(): void {
  console.log(`
📖 Core - SPEC-driven AI coding framework (Claude Code exclusive)

Lifecycle:
  vibe start              데몬 시작 + 인터페이스 활성화 + 부팅 자동시작
  vibe stop               데몬 중지 + 인터페이스 비활성화 + 자동시작 해제
  vibe restart            데몬 재시작

Commands:
  vibe setup              Interactive setup wizard
  vibe init [project]     Initialize project
  vibe update             Update settings
  vibe status             Show status
  vibe sync <cmd>         인증/메모리 동기화 (login, push, pull, status, logout)
  vibe hud [subcommand]   HUD status display
  vibe help               Help
  vibe version            Version

Channels:
  vibe telegram <cmd>     Telegram bot (setup, chat, status)
  vibe slack <cmd>        Slack bot (setup, channel, status)
  vibe imessage <cmd>     iMessage (setup, status) — macOS only
  vibe interface <cmd>    Interface management (list, enable, disable)
  vibe webhook <cmd>      Webhook management (add, list, remove)

Engine:
  vibe job <cmd>          Job commands (list, status, cancel)
  vibe policy <cmd>       Policy commands (list, enable, disable, set)
  vibe device <cmd>       Device management (list, rename, remove)

LLM:
  vibe gpt <cmd>          GPT (auth, key, status, logout)
  vibe gemini <cmd>       Gemini (auth, key, status, logout)
  vibe az <cmd>           AZ (key, status, logout)
  vibe kimi <cmd>         Kimi (key, status, logout)
  vibe config <cmd>       Priority config (embedding-priority, kimi-priority, show)

Slash Commands (Claude Code):
  /vibe.spec "feature"    Create SPEC + parallel research
  /vibe.run "feature"     Execute implementation
  /vibe.verify "feature"  BDD verification
  /vibe.review            Parallel code review (13+ agents)
  /vibe.reason "problem"  Systematic reasoning
  /vibe.analyze           Project analysis
  /vibe.utils             Utilities (--e2e, --diagram, --continue)
  /vibe.voice             Voice-to-coding (Gemini + sox)

Workflow:
  /vibe.spec "feature" ultrawork    Full automation (SPEC→Review→Implement)
  /vibe.spec → /vibe.run            Manual step-by-step

Docs: https://github.com/su-record/core
  `);
}

/**
 * 상태 표시
 */
export function showStatus(): void {
  const projectRoot = process.cwd();
  const coreDir = path.join(projectRoot, '.claude', 'vibe');
  const configPath = path.join(coreDir, 'config.json');

  const packageJson = getPackageJson();
  const isCoreProject = fs.existsSync(coreDir);

  let config: VibeConfig = { language: 'ko', models: {} };
  if (isCoreProject && fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  const authStatus = getLLMAuthStatus();

  const gptStatusText = formatAuthMethods(authStatus.gpt);
  const geminiStatusText = formatAuthMethods(authStatus.gemini);
  const azStatusText = formatAuthMethods(authStatus.az);
  const kimiStatusText = formatAuthMethods(authStatus.kimi);

  // Voice 상태 (Gemini 활성화 + sox 설치)
  let voiceStatusText = '⬚ Disabled (requires Gemini)';
  if (authStatus.gemini.length > 0) {
    if (isSoxInstalled()) {
      voiceStatusText = '✅ Ready';
    } else {
      const soxCmd = process.platform === 'darwin' ? 'brew install sox'
        : process.platform === 'win32' ? 'choco install sox' : 'apt install sox';
      voiceStatusText = `⚠️  sox not installed (${soxCmd})`;
    }
  }

  // vibe sync 상태
  const syncAuth = loadSyncAuth();
  const syncStatusText = syncAuth ? `✅ ${syncAuth.email ?? 'Logged in'}` : '⬚ Not logged in (vibe sync login)';

  // 프로젝트 상태
  const projectStatus = isCoreProject
    ? `✅ ${projectRoot}`
    : `⬚ Not a core project (run: vibe init)`;

  console.log(`
📊 Core Status (v${packageJson.version})

Project: ${projectStatus}
${isCoreProject ? `Language: ${config.language || 'ko'}` : ''}

Auth:
  GPT             ${gptStatusText}
  Gemini          ${geminiStatusText}
  AZ              ${azStatusText}
  Kimi            ${kimiStatusText}

Features:
  /vibe.voice       ${voiceStatusText}
  vibe sync         ${syncStatusText}
  `);
}

/**
 * 버전 표시
 */
export function showVersion(): void {
  const packageJson = getPackageJson();
  console.log(`core v${packageJson.version}`);
}
