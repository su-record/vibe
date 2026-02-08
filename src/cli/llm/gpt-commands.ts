/**
 * GPT CLI 명령어
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
 * GPT OAuth 핵심 로직 (process.exit 없음)
 * setup 위저드 및 gptAuth()에서 공유
 * @returns 성공 시 OAuthTokens, 실패 시 null
 */
export async function gptAuthCore(): Promise<OAuthTokens | null> {
  try {
    const gptOAuthPath = path.join(__dirname, '../../lib/gpt-oauth.js');
    const gptStoragePath = path.join(__dirname, '../../lib/gpt-storage.js');

    const { startOAuthFlow } = require(gptOAuthPath);
    const storage = require(gptStoragePath);

    console.log('\nOpening browser for OpenAI OAuth...\n');
    const tokens: OAuthTokens = await startOAuthFlow();

    storage.addAccount({
      email: tokens.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      expires: tokens.expires,
      accountId: tokens.accountId,
    });

    // config.json 업데이트
    const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!config.models) config.models = {};
        config.models.gpt = {
          enabled: true,
          authType: 'oauth',
          email: tokens.email,
          role: 'architecture',
          description: 'GPT (ChatGPT Plus/Pro)',
        };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      } catch { /* ignore: optional operation */ }
    }

    console.log(`GPT authenticated! (${tokens.email})`);

    // Windows libuv 핸들 충돌 방지: 서버 완전 종료 대기
    await new Promise(resolve => setTimeout(resolve, 200));
    return tokens;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`GPT authentication failed: ${message}`);
    return null;
  }
}

/**
 * GPT OAuth 인증 (CLI 명령어용)
 */
export async function gptAuth(): Promise<void> {
  console.log(`
🔐 GPT Plus/Pro Authentication (OAuth)

With ChatGPT Plus or Pro subscription, you can use the Codex API.
Login with your OpenAI account in browser.
  `);

  const tokens = await gptAuthCore();

  if (tokens) {
    console.log(`
Account: ${tokens.email}
Account ID: ${tokens.accountId || '(auto-detected)'}

⚠️  Note: ChatGPT Plus/Pro subscription required for API calls.

Status: vibe gpt status
Logout: vibe gpt logout

GPT is called via Hooks:
  - Auto-called with "gpt. query" prefix
  - Direct use: import('@su-record/core/lib/gpt')
    `);
    process.exit(0);
  } else {
    console.error('\nRetry: vibe gpt auth');
    process.exit(1);
  }
}

/**
 * GPT 상태 확인
 */
export function gptStatus(): void {
  try {
    const gptStoragePath = path.join(__dirname, '../../lib/gpt-storage.js');
    const storage = require(gptStoragePath);

    const accounts = storage.getAllAccounts();

    if (accounts.length === 0) {
      console.log(`
📊 GPT Status

No authenticated account

Login: vibe gpt auth
      `);
      return;
    }

    const activeAccount = storage.getActiveAccount();
    const isExpired = storage.isTokenExpired(activeAccount);

    console.log(`
📊 GPT Status

Active: ${activeAccount.email}
Account ID: ${activeAccount.accountId || '(none)'}
Token: ${isExpired ? '⚠️  Expired (auto-refresh)' : '✅ Valid'}
Last used: ${new Date(activeAccount.lastUsed).toLocaleString()}

Accounts (${accounts.length}):
${accounts.map((acc: { email: string }, i: number) => `  ${i === storage.loadAccounts()?.activeIndex ? '→' : ' '} ${acc.email}`).join('\n')}

⚠️  Note: ChatGPT Plus/Pro subscription required.

Logout: vibe gpt logout
    `);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Status check failed:', message);
  }
}

/**
 * GPT 로그아웃
 */
export function gptLogout(): void {
  try {
    const gptStoragePath = path.join(__dirname, '../../lib/gpt-storage.js');
    const storage = require(gptStoragePath);

    const activeAccount = storage.getActiveAccount();

    if (!activeAccount) {
      console.log('No account logged in.');
      return;
    }

    storage.clearAccounts();

    console.log(`
✅ GPT logged out

Account ${activeAccount.email} removed.

Login again: vibe gpt auth
    `);

    // config.json 업데이트
    const projectRoot = process.cwd();
    const coreDir = path.join(projectRoot, '.claude', 'vibe');
    const configPath = path.join(coreDir, 'config.json');

    if (fs.existsSync(configPath)) {
      try {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.models?.gpt) {
          config.models.gpt.enabled = false;
          config.models.gpt.authType = undefined;
          config.models.gpt.email = undefined;
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }
      } catch { /* ignore: optional operation */ }
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Logout failed:', message);
  }
}
