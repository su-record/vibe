/**
 * LLM 인증 관련 함수
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { LLMAuthStatus, LLMStatusMap, VibeConfig } from './types.js';

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

  const status: LLMStatusMap = { gpt: [], gemini: [], az: [] };

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

  return status;
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

export function formatLLMStatus(): string {
  const status = getLLMAuthStatus();
  const lines: string[] = [];

  lines.push('🤖 External LLM:');
  lines.push(`  GPT: ${formatAuthMethods(status.gpt)}`);
  lines.push(`  Gemini: ${formatAuthMethods(status.gemini)}`);
  lines.push(`  AZ: ${formatAuthMethods(status.az)}`);

  return lines.join('\n');
}
