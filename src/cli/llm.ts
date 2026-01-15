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
❌ API 키가 필요합니다.

사용법:
  vibe ${llmType} <api-key>

${llmType === 'gpt' ? 'OpenAI API 키: https://platform.openai.com/api-keys' : 'Google API 키: https://aistudio.google.com/apikey'}
    `);
    return;
  }

  const projectRoot = process.cwd();
  const vibeDir = path.join(projectRoot, '.claude', 'vibe');
  const configPath = path.join(vibeDir, 'config.json');

  if (!fs.existsSync(vibeDir)) {
    console.log('❌ vibe 프로젝트가 아닙니다. 먼저 vibe init을 실행하세요.');
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
    role: llmConfig.role,
    description: llmConfig.description
  };

  // API 키를 config에 저장 (암호화 없이 - 로컬 전용)
  config.models[llmType as 'gpt' | 'gemini']!.apiKey = apiKey;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`
✅ ${llmType.toUpperCase()} API 키 설정 완료!

역할: ${llmConfig.description}

${llmType.toUpperCase()}는 Hook으로 직접 호출됩니다:
  - "${llmType}한테 물어봐" 키워드로 자동 호출
  - import('@su-record/vibe/lib/${llmType}') 로 직접 사용 가능

비활성화: vibe remove ${llmType}
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
    console.log('❌ vibe 프로젝트가 아닙니다.');
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
  console.log(`✅ ${llmType.toUpperCase()} 비활성화 완료`);
}

// ============================================================================
// GPT OAuth Commands
// ============================================================================

/**
 * GPT OAuth 인증
 */
export async function gptAuth(): Promise<void> {
  console.log(`
🔐 GPT Plus/Pro 인증 (OAuth)

ChatGPT Plus 또는 Pro 구독이 있으면 Codex API를 사용할 수 있습니다.
브라우저에서 OpenAI 계정으로 로그인하세요.
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
✅ GPT 인증 완료!

계정: ${tokens.email}
계정 ID: ${tokens.accountId || '(자동 감지)'}

⚠️  참고: ChatGPT Plus/Pro 구독이 있어야 API 호출이 가능합니다.
    구독이 없으면 인증은 성공하지만 API 호출 시 오류가 발생합니다.

상태 확인: vibe status gpt
로그아웃: vibe logout gpt
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
GPT는 Hook으로 직접 호출됩니다:
  - "gpt한테 물어봐" 키워드로 자동 호출
  - import('@su-record/vibe/lib/gpt') 로 직접 사용 가능
    `);

    process.exit(0);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`
❌ GPT 인증 실패

오류: ${message}

다시 시도하려면: vibe gpt --auth
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
📊 GPT 인증 상태

인증된 계정 없음

로그인: vibe gpt --auth
      `);
      return;
    }

    const activeAccount = storage.getActiveAccount();
    const isExpired = storage.isTokenExpired(activeAccount);

    console.log(`
📊 GPT 인증 상태

활성 계정: ${activeAccount.email}
계정 ID: ${activeAccount.accountId || '(없음)'}
토큰 상태: ${isExpired ? '⚠️  만료됨 (자동 갱신됨)' : '✅ 유효'}
마지막 사용: ${new Date(activeAccount.lastUsed).toLocaleString()}

등록된 계정 (${accounts.length}개):
${accounts.map((acc: { email: string }, i: number) => `  ${i === storage.loadAccounts()?.activeIndex ? '→' : ' '} ${acc.email}`).join('\n')}

⚠️  참고: ChatGPT Plus/Pro 구독이 있어야 API 호출이 가능합니다.

로그아웃: vibe logout gpt
    `);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('상태 확인 실패:', message);
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
      console.log('로그인된 계정이 없습니다.');
      return;
    }

    storage.clearAccounts();

    console.log(`
✅ GPT 로그아웃 완료

${activeAccount.email} 계정이 제거되었습니다.

다시 로그인: vibe gpt --auth
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
    console.error('로그아웃 실패:', message);
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
🔐 Gemini 구독 인증 (OAuth)

Gemini Advanced 구독이 있으면 추가 비용 없이 사용할 수 있습니다.
브라우저에서 Google 계정으로 로그인하세요.
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
✅ Gemini 인증 완료!

계정: ${tokens.email}
프로젝트: ${tokens.projectId || '(자동 감지)'}

사용 가능한 모델:
  - Gemini 3 Flash (빠른 응답, 탐색/검색)
  - Gemini 3 Pro (높은 정확도)

/vibe.run 실행 시 자동으로 Gemini가 보조 모델로 활용됩니다.

상태 확인: vibe status gemini
로그아웃: vibe logout gemini
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
Gemini는 Hook으로 직접 호출됩니다:
  - "gemini한테 물어봐" 키워드로 자동 호출
  - import('@su-record/vibe/lib/gemini') 로 직접 사용 가능
    `);

    process.exit(0);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`
❌ Gemini 인증 실패

오류: ${message}

다시 시도하려면: vibe gemini --auth
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
📊 Gemini 인증 상태

인증된 계정 없음

로그인: vibe gemini --auth
      `);
      return;
    }

    const activeAccount = storage.getActiveAccount();
    const isExpired = storage.isTokenExpired(activeAccount);

    console.log(`
📊 Gemini 인증 상태

활성 계정: ${activeAccount.email}
프로젝트: ${activeAccount.projectId || '(자동)'}
토큰 상태: ${isExpired ? '⚠️  만료됨 (자동 갱신됨)' : '✅ 유효'}
마지막 사용: ${new Date(activeAccount.lastUsed).toLocaleString()}

등록된 계정 (${accounts.length}개):
${accounts.map((acc: { email: string }, i: number) => `  ${i === storage.loadAccounts()?.activeIndex ? '→' : ' '} ${acc.email}`).join('\n')}

사용 가능한 모델:
${Object.entries(GEMINI_MODELS).map(([id, info]) => `  - ${id}: ${(info as { description: string }).description}`).join('\n')}

로그아웃: vibe logout gemini
    `);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('상태 확인 실패:', message);
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
      console.log('로그인된 계정이 없습니다.');
      return;
    }

    storage.clearAccounts();

    console.log(`
✅ Gemini 로그아웃 완료

${activeAccount.email} 계정이 제거되었습니다.

다시 로그인: vibe gemini --auth
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
    console.error('로그아웃 실패:', message);
  }
}

// ============================================================================
// Help Functions
// ============================================================================

/**
 * 인증 도움말
 */
export function showAuthHelp(): void {
  console.log(`
🔐 vibe auth - LLM 인증

사용법:
  vibe auth gpt              GPT Plus/Pro OAuth 인증
  vibe auth gpt --key <key>  GPT API 키로 설정
  vibe auth gemini           Gemini 구독 OAuth 인증 (권장)
  vibe auth gemini --key <key>  Gemini API 키로 설정

예시:
  vibe auth gpt              OpenAI 로그인 (Plus/Pro 구독 필요)
  vibe auth gemini           Google 로그인 (Gemini Advanced 구독 시 무료)
  vibe auth gpt --key sk-xxx API 키로 설정 (사용량 과금)
  `);
}

/**
 * 로그아웃 도움말
 */
export function showLogoutHelp(): void {
  console.log(`
🚪 vibe logout - LLM 로그아웃

사용법:
  vibe logout gpt     GPT 로그아웃
  vibe logout gemini  Gemini 로그아웃
  `);
}
