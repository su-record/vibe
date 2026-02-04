/**
 * 외부 LLM 관련 함수 (GPT, Gemini)
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { ExternalLLMConfig, VibeConfig, OAuthTokens } from './types.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 외부 LLM 설정
 */
export const EXTERNAL_LLMS: Record<string, ExternalLLMConfig> = {
  gpt: {
    name: 'core-gpt',
    role: 'architecture',
    description: 'Architecture/Debugging (GPT 5.2)',
    package: '@anthropics/openai-mcp',
    envKey: 'OPENAI_API_KEY'
  },
  gemini: {
    name: 'core-gemini',
    role: 'ui-ux',
    description: 'UI/UX Design (Gemini 3)',
    package: '@anthropics/gemini-mcp',
    envKey: 'GOOGLE_API_KEY'
  }
};

/**
 * 전역 설정 디렉토리 경로 가져오기
 */
function getGlobalConfigDir(): string {
  return process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'core')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'core');
}

/**
 * 외부 LLM API 키로 설정 (전역 저장소)
 */
export function setupExternalLLM(llmType: string, apiKey: string): void {
  if (!apiKey) {
    console.log(`
❌ API key required.

Usage:
  core ${llmType} key <api-key>

${llmType === 'gpt' ? 'OpenAI API key: https://platform.openai.com/api-keys' : 'Google API key: https://aistudio.google.com/apikey'}
    `);
    return;
  }

  // 전역 설정 디렉토리에 저장
  const globalConfigDir = getGlobalConfigDir();
  if (!fs.existsSync(globalConfigDir)) {
    fs.mkdirSync(globalConfigDir, { recursive: true });
  }

  const authFile = path.join(globalConfigDir, `${llmType}-apikey.json`);
  const authData = {
    type: 'apikey',
    apiKey: apiKey,
    createdAt: Date.now()
  };

  fs.writeFileSync(authFile, JSON.stringify(authData, null, 2));

  const llmConfig = EXTERNAL_LLMS[llmType];

  // 프로젝트 config.json도 업데이트 (선택적)
  const projectRoot = process.cwd();
  const coreDir = path.join(projectRoot, '.claude', 'core');
  const configPath = path.join(coreDir, 'config.json');

  if (fs.existsSync(configPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (!config.models) config.models = {};
      config.models[llmType as 'gpt' | 'gemini'] = {
        enabled: true,
        authType: 'apikey',
        role: llmConfig.role,
        description: llmConfig.description,
      };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch { /* ignore: optional operation */ }
  }

  console.log(`
✅ ${llmType.toUpperCase()} API key configured!

Role: ${llmConfig.description}
Stored: ${authFile}

${llmType.toUpperCase()} is called directly via Hooks:
  - Auto-called with "${llmType}. query" prefix
  - Direct use: import('@su-record/core/lib/${llmType}')

Disable: core ${llmType} remove
  `);
}

/**
 * 외부 LLM 제거 (전역 + 프로젝트)
 */
export function removeExternalLLM(llmType: string): void {
  const globalConfigDir = getGlobalConfigDir();
  let removed = false;

  // 1. 전역 API 키 파일 삭제
  const apiKeyFile = path.join(globalConfigDir, `${llmType}-apikey.json`);
  if (fs.existsSync(apiKeyFile)) {
    fs.unlinkSync(apiKeyFile);
    removed = true;
  }

  // 2. 전역 OAuth 토큰 파일 삭제
  const authFile = path.join(globalConfigDir, `${llmType}-auth.json`);
  if (fs.existsSync(authFile)) {
    fs.unlinkSync(authFile);
    removed = true;
  }

  // 3. 프로젝트 config.json 비활성화 (선택적)
  const projectRoot = process.cwd();
  const coreDir = path.join(projectRoot, '.claude', 'core');
  const configPath = path.join(coreDir, 'config.json');

  if (fs.existsSync(configPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.models?.[llmType as 'gpt' | 'gemini']) {
        config.models[llmType as 'gpt' | 'gemini']!.enabled = false;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
    } catch { /* ignore */ }
  }

  if (removed) {
    console.log(`✅ ${llmType.toUpperCase()} credentials removed`);
  } else {
    console.log(`ℹ️ ${llmType.toUpperCase()} no credentials found`);
  }
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

Status: su gpt status
Logout: su gpt logout
    `);

    // config.json 업데이트
    const projectRoot = process.cwd();
    const coreDir = path.join(projectRoot, '.claude', 'core');
    const configPath = path.join(coreDir, 'config.json');

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
  - Direct use: import('@su-record/core/lib/gpt')
    `);

    // Windows libuv 핸들 충돌 방지: 서버 완전 종료 대기
    await new Promise(resolve => setTimeout(resolve, 200));
    process.exit(0);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`
❌ GPT authentication failed

Error: ${message}

Retry: su gpt auth
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

Login: su gpt auth
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

Logout: su gpt logout
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

Login again: su gpt auth
    `);

    // config.json 업데이트
    const projectRoot = process.cwd();
    const coreDir = path.join(projectRoot, '.claude', 'core');
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

Status: su gemini status
Logout: su gemini logout
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

Retry: su gemini auth
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

Login: su gemini auth
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

Logout: su gemini logout
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

Login again: su gemini auth
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

// ============================================================================
// Help Functions
// ============================================================================

/**
 * Auth help (legacy - now shows new format)
 */
export function showAuthHelp(): void {
  console.log(`
🔐 LLM Authentication

GPT Commands:
  su gpt auth           OAuth (Plus/Pro subscription)
  su gpt key <KEY>      API key

Gemini Commands:
  su gemini auth        OAuth (free with Advanced)
  su gemini key <KEY>   API key

Examples:
  su gpt auth           OpenAI login
  su gemini auth        Google login
  su gpt key sk-xxx     API key setup
  `);
}

/**
 * Logout help (legacy - now shows new format)
 */
export function showLogoutHelp(): void {
  console.log(`
🚪 LLM Logout

Usage:
  su gpt logout       GPT logout
  su gemini logout    Gemini logout
  `);
}
