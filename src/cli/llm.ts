/**
 * 외부 LLM 관련 함수 (GPT, Gemini)
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { ExternalLLMConfig, VibeConfig, OAuthTokens } from './types.js';
import { unregisterMcp } from './mcp.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 외부 LLM 설정
 */
export const EXTERNAL_LLMS: Record<string, ExternalLLMConfig> = {
  gpt: {
    name: 'vibe-gpt',
    role: 'architecture',
    description: '아키텍처/디버깅 (GPT 5.2)',
    package: '@anthropics/openai-mcp',
    envKey: 'OPENAI_API_KEY'
  },
  gemini: {
    name: 'vibe-gemini',
    role: 'ui-ux',
    description: 'UI/UX 설계 (Gemini 3)',
    package: '@anthropics/gemini-mcp',
    envKey: 'GOOGLE_API_KEY'
  }
};

/**
 * 외부 LLM API 키로 설정
 */
export function setupExternalLLM(llmType: string, apiKey: string): void {
  if (!apiKey) {
    console.log(`
❌ API key required.

Usage:
  vibe ${llmType} <api-key>

${llmType === 'gpt' ? 'OpenAI API key: https://platform.openai.com/api-keys' : 'Google API key: https://aistudio.google.com/apikey'}
    `);
    return;
  }

  const projectRoot = process.cwd();
  const vibeDir = path.join(projectRoot, '.claude', 'vibe');
  const configPath = path.join(vibeDir, 'config.json');

  if (!fs.existsSync(vibeDir)) {
    console.log('❌ Not a vibe project. Run vibe init first.');
    return;
  }

  let config: VibeConfig = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  if (!config.models) {
    config.models = {};
  }

  const llmConfig = EXTERNAL_LLMS[llmType];
  config.models[llmType as 'gpt' | 'gemini'] = {
    enabled: true,
    authType: 'apikey',
    role: llmConfig.role,
    description: llmConfig.description,
    apiKey: apiKey
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`
✅ ${llmType.toUpperCase()} API key configured!

Role: ${llmConfig.description}

${llmType.toUpperCase()} is called directly via Hooks:
  - Auto-called with "${llmType}. query" prefix
  - Direct use: import('@su-record/vibe/lib/${llmType}')

Disable: vibe remove ${llmType}
  `);
}

/**
 * 외부 LLM 제거
 */
export function removeExternalLLM(llmType: string): void {
  const projectRoot = process.cwd();
  const vibeDir = path.join(projectRoot, '.claude', 'vibe');
  const configPath = path.join(vibeDir, 'config.json');

  if (!fs.existsSync(vibeDir)) {
    console.log('❌ Not a vibe project.');
    return;
  }

  if (fs.existsSync(configPath)) {
    const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.models?.[llmType as 'gpt' | 'gemini']) {
      config.models[llmType as 'gpt' | 'gemini']!.enabled = false;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
  }

  const llmConfig = EXTERNAL_LLMS[llmType];

  unregisterMcp(llmConfig.name);
  console.log(`✅ ${llmType.toUpperCase()} disabled`);
}

// ============================================================================
// GPT OAuth Commands
// ============================================================================

/**
 * GPT OAuth 인증
 */
export async function gptAuth(): Promise<void> {
  console.log(`
🔐 GPT Plus/Pro Authentication (OAuth)

With ChatGPT Plus or Pro subscription, you can use the Codex API.
Login with your OpenAI account in browser.
  `);

  try {
    const gptOAuthPath = path.join(__dirname, '../lib/gpt-oauth.js');
    const gptStoragePath = path.join(__dirname, '../lib/gpt-storage.js');

    const { startOAuthFlow } = require(gptOAuthPath);
    const storage = require(gptStoragePath);

    const tokens: OAuthTokens = await startOAuthFlow();

    storage.addAccount({
      email: tokens.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      expires: tokens.expires,
      accountId: tokens.accountId,
    });

    console.log(`
✅ GPT authenticated!

Account: ${tokens.email}
Account ID: ${tokens.accountId || '(auto-detected)'}

⚠️  Note: ChatGPT Plus/Pro subscription required for API calls.

Status: vibe status gpt
Logout: vibe logout gpt
    `);

    // config.json 업데이트
    const projectRoot = process.cwd();
    const vibeDir = path.join(projectRoot, '.claude', 'vibe');
    const configPath = path.join(vibeDir, 'config.json');

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

    console.log(`
GPT is called via Hooks:
  - Auto-called with "gpt. query" prefix
  - Direct use: import('@su-record/vibe/lib/gpt')
    `);

    process.exit(0);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`
❌ GPT authentication failed

Error: ${message}

Retry: vibe gpt --auth
    `);
    process.exit(1);
  }
}

/**
 * GPT 상태 확인
 */
export function gptStatus(): void {
  try {
    const gptStoragePath = path.join(__dirname, '../lib/gpt-storage.js');
    const storage = require(gptStoragePath);

    const accounts = storage.getAllAccounts();

    if (accounts.length === 0) {
      console.log(`
📊 GPT Status

No authenticated account

Login: vibe gpt --auth
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

Logout: vibe logout gpt
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
    const gptStoragePath = path.join(__dirname, '../lib/gpt-storage.js');
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

Login again: vibe gpt --auth
    `);

    // config.json 업데이트
    const projectRoot = process.cwd();
    const vibeDir = path.join(projectRoot, '.claude', 'vibe');
    const configPath = path.join(vibeDir, 'config.json');

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

// ============================================================================
// Gemini OAuth Commands
// ============================================================================

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
    const geminiOAuthPath = path.join(__dirname, '../lib/gemini-oauth.js');
    const geminiStoragePath = path.join(__dirname, '../lib/gemini-storage.js');

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

Status: vibe status gemini
Logout: vibe logout gemini
    `);

    // config.json 업데이트
    const projectRoot = process.cwd();
    const vibeDir = path.join(projectRoot, '.claude', 'vibe');
    const configPath = path.join(vibeDir, 'config.json');

    if (fs.existsSync(configPath)) {
      try {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!config.models) config.models = {};
        config.models.gemini = {
          enabled: true,
          authType: 'oauth',
          email: tokens.email,
          role: 'exploration',
          description: 'Gemini 3 Flash/Pro (탐색, UI/UX)',
        };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      } catch { /* ignore: optional operation */ }
    }

    console.log(`
Gemini is called via Hooks:
  - Auto-called with "gemini. query" prefix
  - Direct use: import('@su-record/vibe/lib/gemini')
    `);

    process.exit(0);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`
❌ Gemini authentication failed

Error: ${message}

Retry: vibe gemini --auth
    `);
    process.exit(1);
  }
}

/**
 * Gemini 상태 확인
 */
export function geminiStatus(): void {
  try {
    const geminiStoragePath = path.join(__dirname, '../lib/gemini-storage.js');
    const geminiApiPath = path.join(__dirname, '../lib/gemini-api.js');

    const storage = require(geminiStoragePath);
    const { GEMINI_MODELS } = require(geminiApiPath);

    const accounts = storage.getAllAccounts();

    if (accounts.length === 0) {
      console.log(`
📊 Gemini Status

No authenticated account

Login: vibe gemini --auth
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

Logout: vibe logout gemini
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
    const geminiStoragePath = path.join(__dirname, '../lib/gemini-storage.js');
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

Login again: vibe gemini --auth
    `);

    // config.json 업데이트
    const projectRoot = process.cwd();
    const vibeDir = path.join(projectRoot, '.claude', 'vibe');
    const configPath = path.join(vibeDir, 'config.json');

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

// ============================================================================
// Help Functions
// ============================================================================

/**
 * Auth help
 */
export function showAuthHelp(): void {
  console.log(`
🔐 vibe auth - LLM Authentication

Usage:
  vibe auth gpt                   GPT Plus/Pro OAuth
  vibe auth gpt --key <key>       GPT API key
  vibe auth gemini                Gemini OAuth (recommended)
  vibe auth gemini --key <key>    Gemini API key

Examples:
  vibe auth gpt                   OpenAI login (Plus/Pro subscription required)
  vibe auth gemini                Google login (free with Gemini Advanced)
  vibe auth gpt --key sk-xxx      API key (usage-based billing)
  `);
}

/**
 * Logout help
 */
export function showLogoutHelp(): void {
  console.log(`
🚪 vibe logout - LLM Logout

Usage:
  vibe logout gpt       GPT logout
  vibe logout gemini    Gemini logout
  `);
}
