/**
 * GPT CLI 명령어
 * config.json 통합 방식 (v2)
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { VibeConfig, OAuthTokens } from '../types.js';
import {
  patchGlobalConfig,
  readGlobalConfig,
  writeGlobalConfig,
} from '../../infra/lib/config/GlobalConfigManager.js';

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
    const gptOAuthPath = path.join(__dirname, '../../infra/lib/gpt/oauth.js');
    const { startOAuthFlow } = require(gptOAuthPath);

    console.log('\nOpening browser for OpenAI OAuth...\n');
    const tokens: OAuthTokens = await startOAuthFlow();

    // config.json에 저장
    patchGlobalConfig({
      credentials: {
        gpt: {
          oauthRefreshToken: tokens.refreshToken,
          oauthEmail: tokens.email,
          createdAt: new Date().toISOString(),
        },
      },
    });

    // 프로젝트 config.json도 업데이트 (선택적)
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
GPT Plus/Pro Authentication (OAuth)

With ChatGPT Plus or Pro subscription, you can use the Codex API.
Login with your OpenAI account in browser.
  `);

  const tokens = await gptAuthCore();

  if (tokens) {
    console.log(`
Account: ${tokens.email}
Account ID: ${tokens.accountId || '(auto-detected)'}

Stored in: ~/.vibe/config.json

Status: vibe gpt status
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
  const config = readGlobalConfig();
  const gptCreds = config.credentials?.gpt;
  const hasOAuth = Boolean(gptCreds?.oauthRefreshToken || process.env.GPT_OAUTH_REFRESH_TOKEN);
  const hasApiKey = Boolean(gptCreds?.apiKey || process.env.OPENAI_API_KEY);

  if (!hasOAuth && !hasApiKey) {
    console.log(`
GPT Status

No credentials configured.

Setup:
  vibe gpt auth           OAuth (ChatGPT Plus/Pro)
  vibe gpt key <api-key>  API Key
    `);
    return;
  }

  const methods: string[] = [];
  if (hasOAuth) {
    const email = gptCreds?.oauthEmail;
    methods.push(`OAuth${email ? ` (${email})` : ''}`);
  }
  if (hasApiKey) methods.push('API Key');

  const modelOverride = config.models?.gpt;

  console.log(`
GPT Status

Auth: ${methods.join(', ')}
${modelOverride ? `Model: ${modelOverride}` : ''}
Stored: ~/.vibe/config.json
  `);
}

/**
 * GPT 로그아웃
 */
export function gptLogout(): void {
  const config = readGlobalConfig();

  if (config.credentials?.gpt) {
    delete config.credentials.gpt;
    writeGlobalConfig(config);
    console.log('GPT credentials removed from ~/.vibe/config.json');
  } else {
    console.log('No GPT credentials found');
  }

  // 프로젝트 config.json도 업데이트 (선택적)
  const projectRoot = process.cwd();
  const configPath = path.join(projectRoot, '.claude', 'vibe', 'config.json');

  if (fs.existsSync(configPath)) {
    try {
      const projConfig: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (projConfig.models?.gpt) {
        projConfig.models.gpt.enabled = false;
        projConfig.models.gpt.authType = undefined;
        projConfig.models.gpt.email = undefined;
        fs.writeFileSync(configPath, JSON.stringify(projConfig, null, 2));
      }
    } catch { /* ignore */ }
  }
}
