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
  su-core init [project]     Initialize project
  su-core update             Update settings
  su-core status             Show status
  su-core hud [subcommand]   HUD status display
  su-core help               Help
  su-core version            Version

GPT:
  su-core gpt auth           OAuth authentication (Plus/Pro)
  su-core gpt key <KEY>      Set API key
  su-core gpt status         Check status
  su-core gpt logout         Logout
  su-core gpt remove         Remove config

Gemini:
  su-core gemini auth        OAuth authentication
  su-core gemini key <KEY>   Set API key
  su-core gemini status      Check status
  su-core gemini logout      Logout
  su-core gemini remove      Remove config

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

/**
 * 상태 표시
 */
export function showStatus(): void {
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
    : `⬚ Not a core project (run: su-core init)`;

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
