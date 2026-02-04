/**
 * Gemini CLI 명령어
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { VibeConfig, OAuthTokens } from '../types.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Gemini OAuth 인증
 */
export async function geminiAuth(): Promise<void> {
  console.log(`
🔐 Gemini Authentication (OAuth)

With Gemini Advanced subscription, you can use it at no additional cost.
Login with your Google account in browser.
  `);

  try {
    const geminiOAuthPath = path.join(__dirname, '../../lib/gemini-oauth.js');
    const geminiStoragePath = path.join(__dirname, '../../lib/gemini-storage.js');

    const { startOAuthFlow } = require(geminiOAuthPath);
    const storage = require(geminiStoragePath);

    const tokens: OAuthTokens = await startOAuthFlow();

    storage.addAccount({
      email: tokens.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expires: tokens.expires,
      projectId: tokens.projectId,
    });

    console.log(`
✅ Gemini authenticated!

Account: ${tokens.email}
Project: ${tokens.projectId || '(auto-detected)'}

Available models:
  - Gemini 3 Flash (fast, exploration/search)
  - Gemini 3 Pro (high accuracy)

Status: vibe gemini status
Logout: vibe gemini logout
    `);

    // config.json 업데이트
    const projectRoot = process.cwd();
    const coreDir = path.join(projectRoot, '.claude', 'core');
    const configPath = path.join(coreDir, 'config.json');

    if (fs.existsSync(configPath)) {
      try {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!config.models) config.models = {};
        config.models.gemini = {
          enabled: true,
          authType: 'oauth',
          email: tokens.email,
          role: 'exploration',
          description: 'Gemini 3 Flash/Pro (Exploration, UI/UX)',
        };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      } catch { /* ignore: optional operation */ }
    }

    console.log(`
Gemini is called via Hooks:
  - Auto-called with "gemini. query" prefix
  - Direct use: import('@su-record/core/lib/gemini')
    `);

    // Windows libuv 핸들 충돌 방지: 서버 완전 종료 대기
    await new Promise(resolve => setTimeout(resolve, 200));
    process.exit(0);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`
❌ Gemini authentication failed

Error: ${message}

Retry: vibe gemini auth
    `);
    process.exit(1);
  }
}

/**
 * Gemini 상태 확인
 */
export function geminiStatus(): void {
  try {
    const geminiStoragePath = path.join(__dirname, '../../lib/gemini-storage.js');
    const geminiApiPath = path.join(__dirname, '../../lib/gemini-api.js');

    const storage = require(geminiStoragePath);
    const { GEMINI_MODELS } = require(geminiApiPath);

    const accounts = storage.getAllAccounts();

    if (accounts.length === 0) {
      console.log(`
📊 Gemini Status

No authenticated account

Login: vibe gemini auth
      `);
      return;
    }

    const activeAccount = storage.getActiveAccount();
    const isExpired = storage.isTokenExpired(activeAccount);

    console.log(`
📊 Gemini Status

Active: ${activeAccount.email}
Project: ${activeAccount.projectId || '(auto)'}
Token: ${isExpired ? '⚠️  Expired (auto-refresh)' : '✅ Valid'}
Last used: ${new Date(activeAccount.lastUsed).toLocaleString()}

Accounts (${accounts.length}):
${accounts.map((acc: { email: string }, i: number) => `  ${i === storage.loadAccounts()?.activeIndex ? '→' : ' '} ${acc.email}`).join('\n')}

Available models:
${Object.entries(GEMINI_MODELS).map(([id, info]) => `  - ${id}: ${(info as { description: string }).description}`).join('\n')}

Logout: vibe gemini logout
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
    const geminiStoragePath = path.join(__dirname, '../../lib/gemini-storage.js');
    const storage = require(geminiStoragePath);

    const activeAccount = storage.getActiveAccount();

    if (!activeAccount) {
      console.log('No account logged in.');
      return;
    }

    storage.clearAccounts();

    console.log(`
✅ Gemini logged out

Account ${activeAccount.email} removed.

Login again: vibe gemini auth
    `);

    // config.json 업데이트
    const projectRoot = process.cwd();
    const coreDir = path.join(projectRoot, '.claude', 'core');
    const configPath = path.join(coreDir, 'config.json');

    if (fs.existsSync(configPath)) {
      try {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.models?.gemini) {
          config.models.gemini.enabled = false;
          config.models.gemini.authType = undefined;
          config.models.gemini.email = undefined;
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }
      } catch { /* ignore: optional operation */ }
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Logout failed:', message);
  }
}
