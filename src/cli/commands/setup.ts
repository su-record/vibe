/**
 * vibe setup - Interactive TUI Setup Wizard (@clack/prompts)
 *
 * 통합 설정 위자드 (Claude Code 전용으로 간소화)
 * - GPT/Antigravity만 지원
 * - 알림 채널 (Telegram, Slack, Discord)
 */

import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { getLLMAuthStatus, formatAuthMethods } from '../auth.js';
import { antigravityAuthCore } from '../llm/antigravity-commands.js';
import { setupExternalLLM } from '../llm/config.js';
import type { LLMStatusMap } from '../types.js';
import { init } from './init.js';

// ============================================================================
// Types
// ============================================================================

type AuthMethod =
  | 'claude-apikey'
  | 'gpt-apikey'
  | 'antigravity-cli'
  | 'antigravity-apikey';

// ============================================================================
// Phase 1: Status Detection
// ============================================================================

function showCurrentStatus(status: LLMStatusMap): void {
  const lines = [
    `GPT:         ${formatAuthMethods(status.gpt)}`,
    `Antigravity: ${formatAuthMethods(status.antigravity)}`,
  ];
  p.note(lines.join('\n'), 'Current Status');
}

// ============================================================================
// Phase 2: Auth Selection & Collection
// ============================================================================

function buildAuthOptions(status: LLMStatusMap): Array<{
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
      value: 'gpt-apikey' as const,
      label: 'GPT API Key (for embeddings)',
      hint: status.gpt.some(a => a.type === 'apikey')
        ? 'configured'
        : 'platform.openai.com/api-keys',
    },
    {
      value: 'antigravity-cli' as const,
      label: 'Antigravity CLI',
      hint: status.antigravity.some(a => a.type === 'antigravity-cli')
        ? 'configured'
        : 'requires agy',
    },
    {
      value: 'antigravity-apikey' as const,
      label: 'Antigravity API Key',
      hint: status.antigravity.some(a => a.type === 'apikey')
        ? 'configured'
        : 'antigravity.google',
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

    case 'antigravity-cli': {
      const s = p.spinner();
      s.start('Checking Antigravity CLI credentials...');
      try {
        const success = antigravityAuthCore();
        if (success) {
          s.stop('Antigravity CLI credentials detected');
          return true;
        }
        s.stop('Antigravity CLI not found — install from antigravity.google and run agy');
      } catch {
        s.stop('Antigravity CLI check failed');
      }
      return false;
    }

    case 'antigravity-apikey': {
      const key = await p.text({
        message: 'Enter Antigravity API key:',
        validate: (v) => (!(v ?? '').trim() ? 'API key cannot be empty' : undefined),
      });
      if (p.isCancel(key)) return false;
      setupExternalLLM('antigravity', key as string);
      return true;
    }

    default:
      return false;
  }
}

// ============================================================================
// Phase 3: Validation
// ============================================================================

/**
 * 활성화 조건 검증: GPT/Antigravity 중 최소 1개 필요
 */
function validateActivation(status: LLMStatusMap): boolean {
  return (
    status.gpt.length > 0 ||
    status.antigravity.length > 0
  );
}

// ============================================================================
// Summary
// ============================================================================

function showSummary(status: LLMStatusMap): void {
  const lines = [
    `GPT:         ${formatAuthMethods(status.gpt)}`,
    `Antigravity: ${formatAuthMethods(status.antigravity)}`,
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
  showCurrentStatus(initialStatus);

  // ── Phase 2: Auth Selection & Collection ───────────────────────────────

  const authOptions = buildAuthOptions(initialStatus);
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

  // ── Phase 3: Validation ────────────────────────────────────────────────

  const finalStatus = getLLMAuthStatus();

  // 활성화 검증
  if (!validateActivation(finalStatus)) {
    p.log.warn(
      'No providers active. At least one of Claude, GPT, or Antigravity must be configured.'
    );
    p.log.info('Run vibe setup again or use individual commands (vibe gpt key, vibe claude key, etc.)');
  }

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
