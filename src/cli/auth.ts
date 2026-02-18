/**
 * LLM 인증 관련 함수 (config.json 기반)
 */

import { execSync } from 'child_process';
import { LLMAuthStatus, LLMStatusMap, ClaudeCodeStatus } from './types.js';
import { readGlobalConfig } from '../infra/lib/config/GlobalConfigManager.js';

/**
 * LLM 인증 상태 확인 (config.json 우선, process.env fallback)
 */
export function getLLMAuthStatus(): LLMStatusMap {
  const status: LLMStatusMap = { claude: [], gpt: [], gemini: [] };
  const config = readGlobalConfig();

  // GPT
  if (config.credentials?.gpt?.oauthRefreshToken || process.env.GPT_OAUTH_REFRESH_TOKEN) {
    status.gpt.push({ type: 'oauth', valid: true });
  }
  if (config.credentials?.gpt?.apiKey || process.env.OPENAI_API_KEY) {
    status.gpt.push({ type: 'apikey', valid: true });
  }

  // Gemini
  if (config.credentials?.gemini?.oauthRefreshToken || process.env.ANTIGRAVITY_REFRESH_TOKEN || process.env.GEMINI_OAUTH_REFRESH_TOKEN) {
    status.gemini.push({ type: 'oauth', valid: true });
  }
  if (config.credentials?.gemini?.apiKey || process.env.GEMINI_API_KEY) {
    status.gemini.push({ type: 'apikey', valid: true });
  }

  return status;
}

const CLAUDE_AUTH_CHECK_TIMEOUT = 10_000;

/**
 * Claude Code CLI 설치 및 인증 상태 확인
 *
 * @param checkAuth - true이면 실제 API 호출로 인증까지 검증 (vibe init용), false이면 CLI 존재만 확인 (postinstall용)
 * @returns Claude Code 상태 객체
 */
export function getClaudeCodeStatus(checkAuth = false): ClaudeCodeStatus {
  const status: ClaudeCodeStatus = { installed: false, version: null, authenticated: null };

  try {
    const versionOutput = execSync('claude --version', {
      timeout: 5_000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (versionOutput) {
      status.installed = true;
      status.version = versionOutput;
    }
  } catch {
    return status;
  }

  if (!checkAuth) {
    return status;
  }

  try {
    const result = execSync(
      'claude -p "hi" --output-format json --max-budget-usd 0.001 --no-session-persistence',
      {
        timeout: CLAUDE_AUTH_CHECK_TIMEOUT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    const json = JSON.parse(result) as { is_error?: boolean };
    status.authenticated = json.is_error !== true;
  } catch {
    status.authenticated = false;
  }

  return status;
}

/**
 * Claude Code 상태 포맷팅
 */
export function formatClaudeCodeStatus(status: ClaudeCodeStatus): string {
  if (!status.installed) {
    return '✗ Not installed (npm i -g @anthropic-ai/claude-code)';
  }
  if (status.authenticated === null) {
    return `✓ Installed (${status.version})`;
  }
  if (status.authenticated) {
    return `✓ Authenticated (${status.version})`;
  }
  return `⚠ Not authenticated (${status.version}) — run: claude login`;
}

/**
 * LLM 상태 포맷팅
 */
export function formatAuthMethods(auths: LLMAuthStatus[]): string {
  if (auths.length === 0) return '✗ Not configured';
  return auths.map(a => {
    const icon = a.valid ? '✓' : '⚠';
    const method = a.type === 'oauth' ? 'OAuth' : 'API Key';
    return `${icon} ${method}`;
  }).join(', ');
}

export function formatLLMStatus(claudeStatus?: ClaudeCodeStatus): string {
  const status = getLLMAuthStatus();
  const lines: string[] = [];

  if (claudeStatus) {
    lines.push(`🧠 Claude Code: ${formatClaudeCodeStatus(claudeStatus)}`);
  }
  lines.push('🤖 External LLM:');
  lines.push(`  GPT: ${formatAuthMethods(status.gpt)}`);
  lines.push(`  Gemini: ${formatAuthMethods(status.gemini)}`);

  return lines.join('\n');
}
