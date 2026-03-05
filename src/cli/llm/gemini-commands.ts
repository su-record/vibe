/**
 * Gemini CLI 명령어
 *
 * - vibe gemini key: API Key 설정
 * - vibe gemini status: 상태 확인
 * - vibe gemini logout: 설정 제거
 */

import path from 'path';
import fs from 'fs';
import { getGlobalConfigDir } from '../../infra/lib/llm/auth/ConfigManager.js';
import { VibeConfig } from '../types.js';
import {
  patchGlobalConfig,
  readGlobalConfig,
  writeGlobalConfig,
} from '../../infra/lib/config/GlobalConfigManager.js';

/**
 * Gemini 인증 핵심 로직 (process.exit 없음)
 * API Key 확인
 */
export function geminiAuthCore(): boolean {
  const config = readGlobalConfig();
  const apiKey = config.credentials?.gemini?.apiKey || process.env.GEMINI_API_KEY;

  if (apiKey) {
    updateConfigOnAuth('apikey');
    console.log('Gemini API Key configured.');
    return true;
  }

  console.log('No API key found. Run "vibe gemini key <key>" to set up.');
  return false;
}

/**
 * Gemini 인증 (CLI 명령어용)
 */
export async function geminiAuth(): Promise<void> {
  console.log(`
Gemini Authentication

API Key (Google AI Studio):
  vibe gemini key <your-api-key>

Get your API key from:
  https://aistudio.google.com/apikey
  `);

  const config = readGlobalConfig();
  const apiKey = config.credentials?.gemini?.apiKey;

  if (apiKey) {
    console.log('API Key: configured');
    console.log('\nStatus: vibe gemini status');
    console.log('Logout: vibe gemini logout');
    process.exit(0);
  }

  console.log('No API key configured.');
  console.log('Run: vibe gemini key <your-api-key>');
  process.exit(1);
}

/**
 * Gemini 상태 확인
 */
export function geminiStatus(): void {
  try {
    const config = readGlobalConfig();
    const geminiCreds = config.credentials?.gemini;
    const hasApiKey = Boolean(geminiCreds?.apiKey) || Boolean(process.env.GEMINI_API_KEY);

    if (hasApiKey) {
      const modelOverrides = config.models;
      const lines = [
        '\nGemini Status\n',
        'Auth: API Key',
        `Source: ${geminiCreds?.apiKey ? '~/.vibe/config.json' : 'GEMINI_API_KEY env'}`,
      ];
      lines.push('\nModels:');
      lines.push(`  gemini=${modelOverrides?.gemini || process.env.GEMINI_MODEL || '(default)'}`);
      lines.push(`  geminiFlash=${modelOverrides?.geminiFlash || process.env.GEMINI_FLASH_MODEL || '(default)'}\n`);
      console.log(lines.join('\n'));
      return;
    }

    console.log(`
Gemini Status

No credentials found.

Set up:
  vibe gemini key <your-api-key>
  or set GEMINI_API_KEY env var
    `);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Status check failed:', message);
  }
}

/**
 * Gemini 로그아웃
 */
export function geminiLogout(): void {
  try {
    const config = readGlobalConfig();
    if (config.credentials?.gemini) {
      delete config.credentials.gemini;
      writeGlobalConfig(config);
      console.log('Gemini credentials removed from ~/.vibe/config.json');
    }

    const projectRoot = process.cwd();
    const configPath = path.join(projectRoot, '.claude', 'vibe', 'config.json');

    if (fs.existsSync(configPath)) {
      try {
        const projConfig: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (projConfig.models?.gemini) {
          projConfig.models.gemini.enabled = false;
          projConfig.models.gemini.authType = undefined;
          projConfig.models.gemini.email = undefined;
          fs.writeFileSync(configPath, JSON.stringify(projConfig, null, 2));
        }
      } catch { /* ignore */ }
    }

    console.log('Gemini credentials cleared.');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Logout failed:', message);
  }
}

/**
 * config.json에 Gemini 활성화 기록
 */
function updateConfigOnAuth(method: string): void {
  const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
  if (!fs.existsSync(configPath)) return;

  try {
    const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!config.models) config.models = {};
    config.models.gemini = {
      enabled: true,
      authType: method,
      role: 'exploration',
      description: 'Gemini (API Key)',
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch { /* ignore */ }
}
