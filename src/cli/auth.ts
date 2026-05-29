/**
 * LLM 인증 관련 함수 (config.json 기반)
 */

import { execSync } from 'child_process';
import { LLMAuthStatus, LLMStatusMap, ClaudeCodeStatus } from './types.js';
import { readGlobalConfig } from '../infra/lib/config/GlobalConfigManager.js';
import { detectAntigravityCli, detectClaudeCli, detectCodexCli } from './utils/cli-detector.js';

/**
 * LLM 인증 상태 확인 (config.json 우선, process.env fallback)
 */
export function getLLMAuthStatus(): LLMStatusMap {
  const status: LLMStatusMap = { claude: [], gpt: [], antigravity: [] };
  const config = readGlobalConfig();

  // GPT
  if (config.credentials?.gpt?.apiKey || process.env.OPENAI_API_KEY) {
    status.gpt.push({ type: 'apikey', valid: true });
  }

  // Antigravity
  if (config.credentials?.antigravity?.apiKey || process.env.ANTIGRAVITY_API_KEY) {
    status.antigravity.push({ type: 'apikey', valid: true });
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
export function formatAuthMethods(auths: LLMAuthStatus[], cliInstalled?: boolean): string {
  const parts: string[] = [];
  if (cliInstalled !== undefined && cliInstalled) {
    parts.push('✓ CLI');
  }
  parts.push(...auths.map(a => {
    const icon = a.valid ? '✓' : '⚠';
    const method = a.type === 'apikey' ? 'API Key' : a.type;
    return `${icon} ${method}`;
  }));
  if (parts.length === 0) return '⬚ Not connected';
  return parts.join(', ');
}

/**
 * LLM CLI 한 줄 포맷 (설치 + 인증 상태)
 * @param installed CLI 설치 여부
 * @param authenticated 인증 세션 감지 여부 (undefined=미설치, true=인증됨, false=미인증)
 */
function formatLlmCliRow(installed: boolean, authenticated: boolean | undefined): string {
  if (!installed) return '⬚ Not installed';
  if (authenticated === undefined) return '✓ Installed';
  return authenticated ? '✓ Installed, ✓ Auth' : '✓ Installed, ⚠ Not auth';
}

/**
 * 통합 LLM/CLI 상태 포맷터 (status / init / update / upgrade 공용)
 * - LLM CLI (vibe 멀티-오케스트레이션에서 호출 가능): Claude Code, Codex, Antigravity
 * - LLM API Key (직접 호출용): GPT, Antigravity
 */
export function formatLLMStatus(): string {
  const claudeCli = detectClaudeCli();
  const codexCli = detectCodexCli();
  const antigravityCli = detectAntigravityCli();
  const apiStatus = getLLMAuthStatus();

  const claudeRow = formatLlmCliRow(claudeCli.installed, claudeCli.authenticated);
  const codexRow = formatLlmCliRow(codexCli.installed, codexCli.authenticated);
  const antigravityRow = formatLlmCliRow(antigravityCli.installed, antigravityCli.authenticated);

  const gptKey = apiStatus.gpt.length > 0 ? '✓ Key' : '⬚ —';
  const antigravityKey = apiStatus.antigravity.length > 0 ? '✓ Key' : '⬚ —';

  return [
    'LLM CLI (orchestration):',
    `  Claude Code         ${claudeRow}`,
    `  Codex (GPT)         ${codexRow}`,
    `  Antigravity         ${antigravityRow}`,
    '',
    'LLM API Key (direct):',
    `  GPT                 ${gptKey}`,
    `  Antigravity         ${antigravityKey}`,
  ].join('\n');
}
