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

Commands:
  vibe setup              Interactive setup wizard
  vibe init [project]     Initialize project
  vibe update             Update settings
  vibe status             Show status
  vibe sync <cmd>         인증/메모리 동기화 (login, push, pull, status, logout)
  vibe hud [subcommand]   HUD status display
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

AZ:
  vibe az key <KEY>       Set AZ API key
  vibe az status          Check status
  vibe az logout          Remove key
  vibe az remove          Remove config

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
