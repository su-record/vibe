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
 * Gemini OAuth 핵심 로직 (process.exit 없음)
 * setup 위저드 및 geminiAuth()에서 공유
 * @returns 성공 시 OAuthTokens, 실패 시 null
 */
export async function geminiAuthCore(): Promise<OAuthTokens | null> {
  try {
    const geminiOAuthPath = path.join(__dirname, '../../lib/gemini-oauth.js');
    const geminiStoragePath = path.join(__dirname, '../../lib/gemini-storage.js');

    const { startOAuthFlow } = require(geminiOAuthPath);
    const storage = require(geminiStoragePath);

    console.log('\nOpening browser for Google OAuth...\n');
    const tokens: OAuthTokens = await startOAuthFlow();

    storage.addAccount({
      email: tokens.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expires: tokens.expires,
      projectId: tokens.projectId,
    });

    // config.json 업데이트
    const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
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

    console.log(`Gemini authenticated! (${tokens.email})`);

    // Windows libuv 핸들 충돌 방지: 서버 완전 종료 대기
    await new Promise(resolve => setTimeout(resolve, 200));
    return tokens;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Gemini authentication failed: ${message}`);
    return null;
  }
}

/**
 * Gemini OAuth 인증 (CLI 명령어용)
 */
export async function geminiAuth(): Promise<void> {
  console.log(`
🔐 Gemini Authentication (OAuth)

With Gemini Advanced subscription, you can use it at no additional cost.
Login with your Google account in browser.
  `);

  const tokens = await geminiAuthCore();

  if (tokens) {
    console.log(`
Account: ${tokens.email}
Project: ${tokens.projectId || '(auto-detected)'}

Available models:
  - Gemini 3 Flash (fast, exploration/search)
  - Gemini 3 Pro (high accuracy)

Status: vibe gemini status
Logout: vibe gemini logout

Gemini is called via Hooks:
  - Auto-called with "gemini. query" prefix
  - Direct use: import('@su-record/core/lib/gemini')
    `);
    process.exit(0);
  } else {
    console.error('\nRetry: vibe gemini auth');
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
      // Gemini CLI 크레덴셜 감지 확인
      try {
        const geminiAuthPath = path.join(__dirname, '../../lib/gemini/auth.js');
        const { getGeminiCliCredentials } = require(geminiAuthPath);
        const cliCreds = getGeminiCliCredentials();
        if (cliCreds) {
          console.log(`
📊 Gemini Status

No Vibe-specific account, but:
🔍 Gemini CLI credentials detected!

Auto-import: vibe gemini import
Manual auth: vibe gemini auth
          `);
          return;
        }
      } catch { /* ignore: optional check */ }

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
    const coreDir = path.join(projectRoot, '.claude', 'vibe');
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

/**
 * Gemini CLI 크레덴셜 가져오기 핵심 로직
 * @returns 성공 시 true, 실패 시 false
 */
export function geminiImportCore(): boolean {
  try {
    const geminiAuthPath = path.join(__dirname, '../../lib/gemini/auth.js');
    const geminiOAuthPath = path.join(__dirname, '../../lib/gemini-oauth.js');

    const { getGeminiCliCredentials } = require(geminiAuthPath);
    const { importGeminiCliTokens } = require(geminiOAuthPath);

    const cliCreds = getGeminiCliCredentials();
    if (!cliCreds) {
      console.log('No Gemini CLI credentials found.');
      return false;
    }

    importGeminiCliTokens(cliCreds);
    console.log(`Gemini CLI credentials imported! (expires: ${new Date(cliCreds.expiry_date).toLocaleString()})`);
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Import failed: ${message}`);
    return false;
  }
}

/**
 * Gemini CLI 크레덴셜 자동 가져오기 (CLI 명령어용)
 */
export function geminiImport(): void {
  const success = geminiImportCore();
  if (success) {
    console.log('\nStatus: vibe gemini status');
  }
}
