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

  // GPT API 키 확인 (프로젝트 config)
  if (!status.gpt) {
    try {
      const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
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
    // Windows: %APPDATA%/vibe, macOS/Linux: ~/.config/vibe
    const geminiConfigDir = process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
      : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'vibe');
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

  // Gemini API 키 확인 (프로젝트 config)
  if (!status.gemini) {
    try {
      const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
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

  lines.push('외부 LLM:');

  // GPT 상태
  if (status.gpt) {
    if (status.gpt.type === 'oauth') {
      const icon = status.gpt.valid ? '✓' : '⚠';
      lines.push(`  GPT: ${icon} OAuth 인증됨 (${status.gpt.email})`);
    } else {
      lines.push('  GPT: ✓ API 키 설정됨');
    }
  } else {
    lines.push('  GPT: ✗ 미설정 (vibe gpt --auth 또는 vibe gpt <api-key>)');
  }

  // Gemini 상태
  if (status.gemini) {
    if (status.gemini.type === 'oauth') {
      const icon = status.gemini.valid ? '✓' : '⚠';
      lines.push(`  Gemini: ${icon} OAuth 인증됨 (${status.gemini.email})`);
    } else {
      lines.push('  Gemini: ✓ API 키 설정됨');
    }
  } else {
    lines.push('  Gemini: ✗ 미설정 (vibe gemini --auth 또는 vibe gemini <api-key>)');
  }

  return lines.join('\n');
}
