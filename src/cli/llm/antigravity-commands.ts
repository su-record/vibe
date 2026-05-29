/**
 * Antigravity CLI 명령어
 *
 * - vibe antigravity key: API Key 설정
 * - vibe antigravity status: 상태 확인
 * - vibe antigravity logout: 설정 제거
 */

import path from 'path';
import fs from 'fs';
import { getGlobalConfigDir } from '../../infra/lib/llm/auth/ConfigManager.js';
import { VibeConfig } from '../types.js';
import {
  getProjectConfigPath,
  getProjectConfigPaths,
  patchGlobalConfig,
  readGlobalConfig,
  writeGlobalConfig,
} from '../../infra/lib/config/GlobalConfigManager.js';

/**
 * Antigravity 인증 핵심 로직 (process.exit 없음)
 * API Key 확인
 */
export function antigravityAuthCore(): boolean {
  const config = readGlobalConfig();
  const apiKey = config.credentials?.antigravity?.apiKey || process.env.ANTIGRAVITY_API_KEY;

  if (apiKey) {
    updateConfigOnAuth('apikey');
    console.log('Antigravity API Key configured.');
    return true;
  }

  console.log('No API key found. Run "vibe antigravity key <key>" to set up.');
  return false;
}

/**
 * Antigravity 인증 (CLI 명령어용)
 */
export async function antigravityAuth(): Promise<void> {
  console.log(`
Antigravity Authentication

API Key:
  vibe antigravity key <your-api-key>

Antigravity CLI:
  agy
  `);

  const config = readGlobalConfig();
  const apiKey = config.credentials?.antigravity?.apiKey;

  if (apiKey) {
    console.log('API Key: configured');
    console.log('\nStatus: vibe antigravity status');
    console.log('Logout: vibe antigravity logout');
    process.exit(0);
  }

  console.log('No API key configured.');
  console.log('Run: vibe antigravity key <your-api-key>');
  process.exit(1);
}

/**
 * Antigravity 상태 확인
 */
export function antigravityStatus(): void {
  try {
    const config = readGlobalConfig();
    const antigravityCreds = config.credentials?.antigravity;
    const hasApiKey = Boolean(antigravityCreds?.apiKey) || Boolean(process.env.ANTIGRAVITY_API_KEY);

    if (hasApiKey) {
      const modelOverrides = config.models;
      const lines = [
        '\nAntigravity Status\n',
        'Auth: API Key',
        `Source: ${antigravityCreds?.apiKey ? '~/.vibe/config.json' : 'ANTIGRAVITY_API_KEY env'}`,
      ];
      lines.push('\nModels:');
      lines.push(`  antigravity=${modelOverrides?.antigravity || process.env.ANTIGRAVITY_MODEL || '(default)'}\n`);
      console.log(lines.join('\n'));
      return;
    }

    console.log(`
Antigravity Status

No credentials found.

Set up:
  vibe antigravity key <your-api-key>
  or set ANTIGRAVITY_API_KEY env var
    `);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Status check failed:', message);
  }
}

/**
 * Antigravity 로그아웃
 */
export function antigravityLogout(): void {
  try {
    const config = readGlobalConfig();
    if (config.credentials?.antigravity) {
      delete config.credentials.antigravity;
      writeGlobalConfig(config);
      console.log('Antigravity credentials removed from ~/.vibe/config.json');
    }

    const projectRoot = process.cwd();
    const configPath = findExistingProjectConfig(projectRoot);

    if (fs.existsSync(configPath)) {
      try {
        const projConfig: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (projConfig.models?.antigravity) {
          projConfig.models.antigravity.enabled = false;
          projConfig.models.antigravity.authType = undefined;
          projConfig.models.antigravity.email = undefined;
          fs.writeFileSync(configPath, JSON.stringify(projConfig, null, 2));
        }
      } catch { /* ignore */ }
    }

    console.log('Antigravity credentials cleared.');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Logout failed:', message);
  }
}

/**
 * config.json에 Antigravity 활성화 기록
 */
function updateConfigOnAuth(method: string): void {
  const configPath = findExistingProjectConfig(process.cwd());
  if (!fs.existsSync(configPath)) return;

  try {
    const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!config.models) config.models = {};
    config.models.antigravity = {
      enabled: true,
      authType: method,
      role: 'exploration',
      description: 'Antigravity (API Key)',
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch { /* ignore */ }
}

function findExistingProjectConfig(projectRoot: string): string {
  return getProjectConfigPaths(projectRoot).find(p => fs.existsSync(p))
    || getProjectConfigPath(projectRoot);
}
