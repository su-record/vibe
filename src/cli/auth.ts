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
  const status: LLMStatusMap = { gpt: null, gemini: null };

  // GPT 상태 확인
  try {
    const gptStoragePath = path.join(__dirname, '../lib/gpt-storage.js');
    if (fs.existsSync(gptStoragePath)) {
      const gptStorage = require(gptStoragePath);
      const account = gptStorage.getActiveAccount();
      if (account) {
        const isExpired = gptStorage.isTokenExpired(account);
        status.gpt = {
          type: 'oauth',
          email: account.email,
          valid: !isExpired
        };
      }
    }
  } catch { /* ignore: optional operation */ }

  // GPT API 키 확인 (전역 config → 프로젝트 config)
  if (!status.gpt) {
    try {
      // 전역 gpt-apikey.json 확인
      const gptConfigDir = process.platform === 'win32'
        ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'core')
        : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'core');
      const gptApiKeyPath = path.join(gptConfigDir, 'gpt-apikey.json');
      if (fs.existsSync(gptApiKeyPath)) {
        const keyData = JSON.parse(fs.readFileSync(gptApiKeyPath, 'utf-8'));
        if (keyData.apiKey) {
          status.gpt = { type: 'apikey', valid: true };
        }
      }
    } catch { /* ignore: optional operation */ }
  }

  if (!status.gpt) {
    try {
      // 프로젝트 config fallback
      const configPath = path.join(process.cwd(), '.claude', 'core', 'config.json');
      if (fs.existsSync(configPath)) {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.models?.gpt?.enabled) {
          status.gpt = { type: 'apikey', valid: true };
        }
      }
    } catch { /* ignore: optional operation */ }
  }

  // Gemini 상태 확인
  try {
    // Windows: %APPDATA%/core, macOS/Linux: ~/.config/core
    const geminiConfigDir = process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'core')
      : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'core');
    const tokenPath = path.join(geminiConfigDir, 'gemini-auth.json');
    if (fs.existsSync(tokenPath)) {
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      if (tokenData.accounts && tokenData.accounts.length > 0) {
        const activeAccount = tokenData.accounts.find((a: { active?: boolean }) => a.active) || tokenData.accounts[0];
        const isExpired = activeAccount.expires && Date.now() > activeAccount.expires;
        status.gemini = {
          type: 'oauth',
          email: activeAccount.email || 'default',
          valid: !isExpired || !!activeAccount.refreshToken
        };
      }
    }
  } catch { /* ignore: optional operation */ }

  // Gemini API 키 확인 (전역 config → 프로젝트 config)
  if (!status.gemini) {
    try {
      // 전역 gemini-apikey.json 확인
      const geminiKeyConfigDir = process.platform === 'win32'
        ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'core')
        : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'core');
      const geminiApiKeyPath = path.join(geminiKeyConfigDir, 'gemini-apikey.json');
      if (fs.existsSync(geminiApiKeyPath)) {
        const keyData = JSON.parse(fs.readFileSync(geminiApiKeyPath, 'utf-8'));
        if (keyData.apiKey) {
          status.gemini = { type: 'apikey', valid: true };
        }
      }
    } catch { /* ignore: optional operation */ }
  }

  if (!status.gemini) {
    try {
      // 프로젝트 config fallback
      const configPath = path.join(process.cwd(), '.claude', 'core', 'config.json');
      if (fs.existsSync(configPath)) {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.models?.gemini?.enabled) {
          status.gemini = { type: 'apikey', valid: true };
        }
      }
    } catch { /* ignore: optional operation */ }
  }

  return status;
}

/**
 * LLM 상태 포맷팅
 */
export function formatLLMStatus(): string {
  const status = getLLMAuthStatus();
  const lines: string[] = [];

  lines.push('External LLM:');

  // GPT status
  if (status.gpt) {
    if (status.gpt.type === 'oauth') {
      const icon = status.gpt.valid ? '✓' : '⚠';
      lines.push(`  GPT: ${icon} OAuth authenticated (${status.gpt.email})`);
    } else {
      lines.push('  GPT: ✓ API key configured');
    }
  } else {
    lines.push('  GPT: ✗ Not configured (vibe gpt auth or vibe gpt key <api-key>)');
  }

  // Gemini status
  if (status.gemini) {
    if (status.gemini.type === 'oauth') {
      const icon = status.gemini.valid ? '✓' : '⚠';
      lines.push(`  Gemini: ${icon} OAuth authenticated (${status.gemini.email})`);
    } else {
      lines.push('  Gemini: ✓ API key configured');
    }
  } else {
    lines.push('  Gemini: ✗ Not configured (vibe gemini auth or vibe gemini key <api-key>)');
  }

  return lines.join('\n');
}
