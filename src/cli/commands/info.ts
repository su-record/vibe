/**
 * 정보 명령어 (help, status, version)
 */

import path from 'path';
import fs from 'fs';
import { VibeConfig } from '../types.js';
import { getPackageJson } from '../utils.js';
import { getLLMAuthStatus } from '../auth.js';

/**
 * 도움말 표시
 */
export function showHelp(): void {
  console.log(`
📖 Core - SPEC-driven AI coding framework (Claude Code exclusive)

Commands:
  vibe init [project]     Initialize project
  vibe update             Update settings
  vibe status             Show status
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

Slash Commands (Claude Code):
  /vibe.spec "feature"    Create SPEC + parallel research
  /vibe.run "feature"     Execute implementation
  /vibe.verify "feature"  BDD verification
  /vibe.review            Parallel code review (13+ agents)
  /vibe.reason "problem"  Systematic reasoning
  /vibe.analyze           Project analysis
  /vibe.utils             Utilities (--e2e, --diagram, --continue)

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
    : `⬚ Not a core project (run: vibe init)`;

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

/**
 * 버전 표시
 */
export function showVersion(): void {
  const packageJson = getPackageJson();
  console.log(`core v${packageJson.version}`);
}
