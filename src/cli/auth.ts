/**
 * LLM 인증 관련 함수
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { LLMAuthStatus, LLMStatusMap, ClaudeCodeStatus, VibeConfig } from './types.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * LLM 인증 상태 확인
 */
export function getLLMAuthStatus(): LLMStatusMap {
  const configDir = process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'vibe');

  const status: LLMStatusMap = { claude: [], gpt: [], gemini: [], az: [], kimi: [] };

  // Claude API Key
  try {
    const claudeApiKeyPath = path.join(configDir, 'claude-apikey.json');
    if (fs.existsSync(claudeApiKeyPath)) {
      const keyData = JSON.parse(fs.readFileSync(claudeApiKeyPath, 'utf-8'));
      if (keyData.apiKey) {
        status.claude.push({ type: 'apikey', valid: true });
      }
    }
  } catch { /* ignore */ }

  // Claude 환경변수
  if (status.claude.length === 0 && process.env.ANTHROPIC_API_KEY) {
    status.claude.push({ type: 'apikey', valid: true });
  }

  // GPT OAuth
  try {
    const gptStoragePath = path.join(__dirname, '../lib/gpt-storage.js');
    if (fs.existsSync(gptStoragePath)) {
      const gptStorage = require(gptStoragePath);
      const account = gptStorage.getActiveAccount();
      if (account) {
        const isExpired = gptStorage.isTokenExpired(account);
        status.gpt.push({ type: 'oauth', valid: !isExpired });
      }
    }
  } catch { /* ignore */ }

  // GPT API Key
  try {
    const gptApiKeyPath = path.join(configDir, 'gpt-apikey.json');
    if (fs.existsSync(gptApiKeyPath)) {
      const keyData = JSON.parse(fs.readFileSync(gptApiKeyPath, 'utf-8'));
      if (keyData.apiKey) {
        status.gpt.push({ type: 'apikey', valid: true });
      }
    }
  } catch { /* ignore */ }

  // Gemini OAuth
  try {
    const tokenPath = path.join(configDir, 'gemini-auth.json');
    if (fs.existsSync(tokenPath)) {
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      if (tokenData.accounts && tokenData.accounts.length > 0) {
        const activeAccount = tokenData.accounts.find((a: { active?: boolean }) => a.active) || tokenData.accounts[0];
        const isExpired = activeAccount.expires && Date.now() > activeAccount.expires;
        status.gemini.push({ type: 'oauth', valid: !isExpired || !!activeAccount.refreshToken });
      }
    }
  } catch { /* ignore */ }

  // Gemini API Key
  try {
    const geminiApiKeyPath = path.join(configDir, 'gemini-apikey.json');
    if (fs.existsSync(geminiApiKeyPath)) {
      const keyData = JSON.parse(fs.readFileSync(geminiApiKeyPath, 'utf-8'));
      if (keyData.apiKey) {
        status.gemini.push({ type: 'apikey', valid: true });
      }
    }
  } catch { /* ignore */ }

  // AZ API Key (파일)
  try {
    const azStoragePath = path.join(__dirname, '../lib/az-storage.js');
    if (fs.existsSync(azStoragePath)) {
      const azStorage = require(azStoragePath);
      if (azStorage.hasApiKey()) {
        status.az.push({ type: 'apikey', valid: true });
      }
    }
  } catch { /* ignore */ }

  // AZ 환경변수
  if (status.az.length === 0 && process.env.AZ_API_KEY) {
    status.az.push({ type: 'apikey', valid: true });
  }

  // Kimi Direct API Key (파일)
  try {
    const kimiStoragePath = path.join(__dirname, '../lib/kimi-storage.js');
    if (fs.existsSync(kimiStoragePath)) {
      const kimiStorage = require(kimiStoragePath);
      if (kimiStorage.hasApiKey()) {
        status.kimi.push({ type: 'apikey', valid: true });
      }
    }
  } catch { /* ignore */ }

  // Kimi 환경변수
  if (status.kimi.length === 0 && process.env.KIMI_API_KEY) {
    status.kimi.push({ type: 'apikey', valid: true });
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
  lines.push(`  Claude: ${formatAuthMethods(status.claude)}`);
  lines.push(`  GPT: ${formatAuthMethods(status.gpt)}`);
  lines.push(`  Gemini: ${formatAuthMethods(status.gemini)}`);
  lines.push(`  AZ: ${formatAuthMethods(status.az)}`);

  return lines.join('\n');
}
