/**
 * vibe setup - Interactive TUI Setup Wizard (@clack/prompts)
 *
 * OpenClaw/SimpleClaw 스타일의 통합 설정 위자드
 * - Phase 1: 상태 감지 + AZ 자동 발견
 * - Phase 2: 인증 방식 복수 선택 + 순차 수집
 * - Phase 3: 자동 우선순위 + 활성화 검증
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { getLLMAuthStatus, formatAuthMethods } from '../auth.js';
import { gptAuthCore } from '../llm/gpt-commands.js';
import { geminiAuthCore, geminiImportCore } from '../llm/gemini-commands.js';
import { setupExternalLLM, setupAzureFromCli, getGlobalConfigDir } from '../llm/config.js';
import { setEmbeddingPriority, setKimiPriority } from '../llm/priority-commands.js';
import type { LLMStatusMap } from '../types.js';
import { init } from './init.js';
import { GoogleAuthManager } from '../../router/services/GoogleAuthManager.js';

// ============================================================================
// Types
// ============================================================================

type AuthMethod =
  | 'claude-apikey'
  | 'gpt-oauth'
  | 'gpt-apikey'
  | 'gemini-oauth'
  | 'gemini-apikey'
  | 'gemini-import'
  | 'kimi-apikey'
  | 'google-apps';

// ============================================================================
// AZ CLI Detection
// ============================================================================

/**
 * az CLI 설치 여부 확인
 */
function isAzCliAvailable(): boolean {
  try {
    execSync('az --version', { stdio: 'pipe', timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Phase 1: Status Detection
// ============================================================================

/**
 * Google Apps 토큰 존재 여부 확인
 */
function isGoogleAppsAuthenticated(): boolean {
  try {
    const tokenPath = path.join(getGlobalConfigDir(), 'google-tokens.json');
    return fs.existsSync(tokenPath);
  } catch {
    return false;
  }
}

function showCurrentStatus(status: LLMStatusMap, azCliAvailable: boolean, googleAppsOk: boolean): void {
  const lines = [
    `Claude:      ${formatAuthMethods(status.claude)}`,
    `GPT:         ${formatAuthMethods(status.gpt)}`,
    `Gemini:      ${formatAuthMethods(status.gemini)}`,
    `AZ:          ${formatAuthMethods(status.az)}${azCliAvailable && status.az.length === 0 ? chalk.dim(' (az CLI detected)') : ''}`,
    `Kimi:        ${formatAuthMethods(status.kimi)}`,
    `Google Apps: ${googleAppsOk ? '\u2705 Connected (Gmail, Drive, Sheets, Calendar, YouTube)' : '\u2B1A Not connected'}`,
  ];
  p.note(lines.join('\n'), 'Current Status');
}

// ============================================================================
// Phase 2: Auth Selection & Collection
// ============================================================================

function buildAuthOptions(status: LLMStatusMap, googleAppsOk: boolean): Array<{
  value: AuthMethod;
  label: string;
  hint?: string;
}> {
  return [
    {
      value: 'claude-apikey' as const,
      label: 'Claude API Key',
      hint: status.claude.length > 0 ? 'configured' : 'console.anthropic.com/settings/keys',
    },
    {
      value: 'gpt-oauth' as const,
      label: 'GPT OAuth',
      hint: status.gpt.some(a => a.type === 'oauth')
        ? 'configured'
        : 'ChatGPT Plus/Pro — opens browser',
    },
    {
      value: 'gpt-apikey' as const,
      label: 'GPT API Key',
      hint: status.gpt.some(a => a.type === 'apikey')
        ? 'configured'
        : 'platform.openai.com/api-keys',
    },
    {
      value: 'gemini-oauth' as const,
      label: 'Gemini OAuth',
      hint: status.gemini.some(a => a.type === 'oauth')
        ? 'configured'
        : 'Google account — opens browser',
    },
    {
      value: 'gemini-apikey' as const,
      label: 'Gemini API Key',
      hint: status.gemini.some(a => a.type === 'apikey')
        ? 'configured'
        : 'aistudio.google.com/apikey',
    },
    {
      value: 'gemini-import' as const,
      label: 'Gemini CLI Import',
      hint: 'Import from existing Gemini CLI',
    },
    {
      value: 'kimi-apikey' as const,
      label: 'Kimi API Key (Moonshot)',
      hint: status.kimi.length > 0 ? 'configured' : 'platform.moonshot.ai',
    },
    {
      value: 'google-apps' as const,
      label: 'Google Apps (Gmail, Drive, Sheets, Calendar)',
      hint: googleAppsOk ? 'connected' : 'Google account — opens browser',
    },
  ];
}

/**
 * 선택된 인증 방식 실행
 */
async function executeAuthMethod(method: AuthMethod): Promise<boolean> {
  switch (method) {
    case 'claude-apikey': {
      const key = await p.text({
        message: 'Enter Anthropic API key:',
        placeholder: 'sk-ant-...',
        validate: (v) => (!(v ?? '').trim() ? 'API key cannot be empty' : undefined),
      });
      if (p.isCancel(key)) return false;
      setupExternalLLM('claude', key as string);
      return true;
    }

    case 'gpt-oauth': {
      const s = p.spinner();
      s.start('Opening browser for OpenAI OAuth...');
      try {
        const tokens = await gptAuthCore();
        if (tokens) {
          s.stop(`GPT authenticated (${tokens.email})`);
          return true;
        }
        s.stop('GPT OAuth failed');
      } catch {
        s.stop('GPT OAuth failed');
      }
      return false;
    }

    case 'gpt-apikey': {
      const key = await p.text({
        message: 'Enter GPT API key:',
        placeholder: 'sk-...',
        validate: (v) => (!(v ?? '').trim() ? 'API key cannot be empty' : undefined),
      });
      if (p.isCancel(key)) return false;
      setupExternalLLM('gpt', key as string);
      return true;
    }

    case 'gemini-oauth': {
      const s = p.spinner();
      s.start('Opening browser for Google OAuth...');
      try {
        const tokens = await geminiAuthCore();
        if (tokens) {
          s.stop(`Gemini authenticated (${tokens.email})`);
          return true;
        }
        s.stop('Gemini OAuth failed');
      } catch {
        s.stop('Gemini OAuth failed');
      }
      return false;
    }

    case 'gemini-apikey': {
      const key = await p.text({
        message: 'Enter Gemini API key:',
        validate: (v) => (!(v ?? '').trim() ? 'API key cannot be empty' : undefined),
      });
      if (p.isCancel(key)) return false;
      setupExternalLLM('gemini', key as string);
      return true;
    }

    case 'gemini-import': {
      const s = p.spinner();
      s.start('Importing Gemini CLI credentials...');
      try {
        const success = geminiImportCore();
        if (success) {
          s.stop('Gemini CLI credentials imported');
          return true;
        }
        s.stop('No Gemini CLI credentials found');
      } catch {
        s.stop('Gemini CLI import failed');
      }
      return false;
    }

    case 'kimi-apikey': {
      const key = await p.text({
        message: 'Enter Kimi API key (Moonshot):',
        placeholder: 'sk-...',
        validate: (v) => (!(v ?? '').trim() ? 'API key cannot be empty' : undefined),
      });
      if (p.isCancel(key)) return false;
      setupExternalLLM('kimi', key as string);
      return true;
    }

    case 'google-apps': {
      const s = p.spinner();
      s.start('Opening browser for Google Workspace OAuth...');
      try {
        const logger = (level: string, msg: string): void => {
          if (level === 'error') p.log.warn(msg);
        };
        const authManager = new GoogleAuthManager(logger as never);
        const authUrl = authManager.getAuthUrl();

        // 브라우저 열기
        const openCmd = process.platform === 'win32' ? 'start'
          : process.platform === 'darwin' ? 'open' : 'xdg-open';
        execSync(`${openCmd} "${authUrl}"`, { stdio: 'pipe' });

        const code = await authManager.startAuthFlow();
        await authManager.exchangeCode(code);
        s.stop('Google Apps connected (Gmail, Drive, Sheets, Calendar, YouTube)');
        return true;
      } catch {
        s.stop('Google Apps OAuth failed');
      }
      return false;
    }

    default:
      return false;
  }
}

// ============================================================================
// Phase 3: Auto-Configuration
// ============================================================================

/**
 * 활성화 조건 검증: Claude/GPT/Gemini/Kimi 중 최소 1개 필요
 */
function validateActivation(status: LLMStatusMap): boolean {
  return (
    status.claude.length > 0 ||
    status.gpt.length > 0 ||
    status.gemini.length > 0 ||
    status.kimi.length > 0
  );
}

/**
 * 우선순위 자동 설정
 */
async function autoConfigurePriorities(status: LLMStatusMap): Promise<void> {
  const hasAz = status.az.length > 0;
  const hasGpt = status.gpt.length > 0;
  const hasKimi = status.kimi.length > 0;

  // Embedding: AZ → GPT → disabled (자동)
  if (hasAz && hasGpt) {
    setEmbeddingPriority('az,gpt');
  } else if (hasAz) {
    setEmbeddingPriority('az');
  } else if (hasGpt) {
    setEmbeddingPriority('gpt');
  }

  // Kimi: AZ+Kimi 둘 다 있을 때만 사용자에게 질문
  if (hasAz && hasKimi) {
    const kimiPriority = await p.select({
      message: 'Kimi chat priority (AZ + Kimi both available):',
      options: [
        { value: 'az,kimi', label: 'AZ first, Kimi fallback', hint: 'recommended' },
        { value: 'kimi,az', label: 'Kimi first, AZ fallback' },
      ],
    });
    if (!p.isCancel(kimiPriority)) {
      setKimiPriority(kimiPriority as string);
    }
  } else if (hasKimi) {
    setKimiPriority('kimi');
  } else if (hasAz) {
    setKimiPriority('az');
  }
}

// ============================================================================
// Summary
// ============================================================================

function showSummary(status: LLMStatusMap): void {
  const googleAppsOk = isGoogleAppsAuthenticated();
  const lines = [
    `Claude:      ${formatAuthMethods(status.claude)}`,
    `GPT:         ${formatAuthMethods(status.gpt)}`,
    `Gemini:      ${formatAuthMethods(status.gemini)}`,
    `AZ:          ${formatAuthMethods(status.az)}`,
    `Kimi:        ${formatAuthMethods(status.kimi)}`,
    `Google Apps: ${googleAppsOk ? '\u2705 Connected' : '\u2B1A Not connected'}`,
    '',
    'Run /vibe.spec "feature" to start!',
  ];
  p.note(lines.join('\n'), 'Setup Complete');
}

// ============================================================================
// Main Entry
// ============================================================================

export async function setup(): Promise<void> {
  p.intro(chalk.bold('VIBE Setup Wizard'));

  // ── Phase 1: Status Detection ──────────────────────────────────────────

  const initialStatus = getLLMAuthStatus();
  const azCliAvailable = isAzCliAvailable();
  const googleAppsOk = isGoogleAppsAuthenticated();
  showCurrentStatus(initialStatus, azCliAvailable, googleAppsOk);

  // AZ 자동 발견 (az CLI 설치 + 미설정 시)
  if (azCliAvailable && initialStatus.az.length === 0) {
    const s = p.spinner();
    s.start('Discovering Azure Foundry credentials via az CLI...');
    try {
      await setupAzureFromCli();
      s.stop('Azure Foundry auto-configured');
    } catch {
      s.stop('Azure Foundry auto-discovery skipped');
    }
  }

  // ── Phase 2: Auth Selection & Collection ───────────────────────────────

  const authOptions = buildAuthOptions(initialStatus, googleAppsOk);
  const selected = await p.multiselect({
    message: 'Select auth methods to configure (Space to toggle, Enter to confirm):',
    options: authOptions,
    required: false,
  });

  if (p.isCancel(selected)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  const methods = selected as AuthMethod[];

  if (methods.length > 0) {
    for (const method of methods) {
      await executeAuthMethod(method);
    }
  } else {
    p.log.info('No auth methods selected. Skipping credential setup.');
  }

  // ── Phase 3: Auto-Configuration ────────────────────────────────────────

  const finalStatus = getLLMAuthStatus();

  // 활성화 검증
  if (!validateActivation(finalStatus)) {
    p.log.warn(
      'No providers active. At least one of Claude, GPT, Gemini, or Kimi must be configured for agent activation.'
    );
    p.log.info('Run vibe setup again or use individual commands (vibe gpt key, vibe claude key, etc.)');
  }

  // 우선순위 자동 설정
  await autoConfigurePriorities(finalStatus);

  // 프로젝트 초기화
  const coreDir = path.join(process.cwd(), '.claude', 'vibe');
  if (!fs.existsSync(coreDir)) {
    const shouldInit = await p.confirm({
      message: 'Initialize VIBE in current directory?',
      initialValue: true,
    });
    if (!p.isCancel(shouldInit) && shouldInit) {
      init();
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────

  const summaryStatus = getLLMAuthStatus();
  showSummary(summaryStatus);

  p.outro('Setup complete!');
}
