/**
 * Gemini / Antigravity CLI 명령어
 *
 * - vibe gemini auth: Antigravity OAuth 인증 (브라우저 → localhost:51121 콜백)
 * - vibe gemini key: API Key 설정
 * - vibe gemini status: 상태 확인
 * - vibe gemini logout: 설정 제거
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import http from 'http';
import { execSync } from 'child_process';
import { getGlobalConfigDir } from '../../infra/lib/llm/auth/ConfigManager.js';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { VibeConfig } from '../types.js';
import {
  patchGlobalConfig,
  readGlobalConfig,
  writeGlobalConfig,
} from '../../infra/lib/config/GlobalConfigManager.js';
import {
  ANTIGRAVITY_CLIENT_ID,
  ANTIGRAVITY_CLIENT_SECRET,
  ANTIGRAVITY_SCOPES,
  ANTIGRAVITY_REDIRECT_URI,
  ANTIGRAVITY_REDIRECT_PORT,
  GOOGLE_AUTH_URL,
  GOOGLE_TOKEN_URL,
} from '../../infra/lib/gemini/constants.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 크레덴셜 저장 경로
const CRED_PATH = path.join(os.homedir(), '.gemini', 'oauth_creds.json');

// Gemini CLI 크레덴셜 경로 (감지용)
const GEMINI_CLI_CRED_PATHS = [
  CRED_PATH,
  path.join(os.homedir(), '.config', 'gemini-cli', 'oauth_creds.json'),
];

/**
 * 크레덴셜 파일 존재 여부 확인
 */
function findCredentials(): string | null {
  for (const credPath of GEMINI_CLI_CRED_PATHS) {
    try {
      if (fs.existsSync(credPath)) {
        const content = fs.readFileSync(credPath, 'utf-8');
        const data: unknown = JSON.parse(content);
        if (
          data && typeof data === 'object' &&
          'access_token' in data &&
          'refresh_token' in data
        ) {
          return credPath;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * 브라우저 열기 (cross-platform)
 */
function openBrowser(url: string): void {
  try {
    if (process.platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    }
  } catch {
    console.log(`\nOpen this URL in your browser:\n${url}\n`);
  }
}

/**
 * Antigravity OAuth 플로우 실행
 * 1. 로컬 서버 시작 (localhost:51121)
 * 2. 브라우저로 Google OAuth 페이지 열기
 * 3. 콜백에서 auth code 수신
 * 4. auth code → access_token + refresh_token 교환
 * 5. ~/.gemini/oauth_creds.json 저장
 */
async function runOAuthFlow(): Promise<boolean> {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${ANTIGRAVITY_REDIRECT_PORT}`);

      if (url.pathname !== '/oauth-callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Authentication failed</h1><p>You can close this tab.</p>');
        server.close();
        console.error(`\nOAuth error: ${error}`);
        resolve(false);
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>No auth code received</h1>');
        server.close();
        resolve(false);
        return;
      }

      // auth code → token 교환
      try {
        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: ANTIGRAVITY_CLIENT_ID,
            client_secret: ANTIGRAVITY_CLIENT_SECRET,
            redirect_uri: ANTIGRAVITY_REDIRECT_URI,
          }),
        });

        if (!tokenResponse.ok) {
          const errText = await tokenResponse.text();
          throw new Error(`Token exchange failed (${tokenResponse.status}): ${errText}`);
        }

        const tokenData = await tokenResponse.json() as Record<string, unknown>;
        const accessToken = tokenData.access_token as string;
        const refreshToken = tokenData.refresh_token as string;
        const expiresIn = (tokenData.expires_in as number) || 3600;
        const scope = (tokenData.scope as string) || ANTIGRAVITY_SCOPES.join(' ');
        const idToken = tokenData.id_token as string | undefined;

        if (!accessToken || !refreshToken) {
          throw new Error('Missing access_token or refresh_token');
        }

        // 크레덴셜 저장
        const creds = {
          access_token: accessToken,
          refresh_token: refreshToken,
          scope,
          token_type: 'Bearer',
          ...(idToken ? { id_token: idToken } : {}),
          expiry_date: Date.now() + expiresIn * 1000,
        };

        const dir = path.dirname(CRED_PATH);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CRED_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <h1>Authentication successful!</h1>
          <p>You can close this tab and return to the terminal.</p>
          <script>setTimeout(() => window.close(), 2000);</script>
        `);

        server.close();
        console.log('\nAuthentication successful!');

        // config.json에 저장
        patchGlobalConfig({
          credentials: {
            gemini: {
              oauthRefreshToken: refreshToken,
              oauthSource: 'antigravity',
              createdAt: new Date().toISOString(),
            },
          },
        });

        console.log(`Credentials saved: ${CRED_PATH}`);
        updateConfigOnAuth('antigravity');
        resolve(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Error</h1><p>${msg}</p>`);
        server.close();
        console.error(`\nToken exchange failed: ${msg}`);
        resolve(false);
      }
    });

    server.on('error', (err) => {
      console.error(`\nFailed to start OAuth server: ${err.message}`);
      console.log('Port 51121 might be in use. Try closing Antigravity IDE first.');
      resolve(false);
    });

    server.listen(ANTIGRAVITY_REDIRECT_PORT, () => {
      const authUrl = `${GOOGLE_AUTH_URL}?` + new URLSearchParams({
        client_id: ANTIGRAVITY_CLIENT_ID,
        redirect_uri: ANTIGRAVITY_REDIRECT_URI,
        response_type: 'code',
        scope: ANTIGRAVITY_SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
      }).toString();

      console.log('Opening browser for Google authentication...');
      openBrowser(authUrl);
      console.log('Waiting for callback on localhost:51121...');

      // 2분 타임아웃
      setTimeout(() => {
        server.close();
        console.log('\nTimeout: no response received within 2 minutes.');
        resolve(false);
      }, 120_000);
    });
  });
}

/**
 * Gemini 인증 핵심 로직 (process.exit 없음)
 * 1순위: Antigravity OAuth 플로우 실행
 * 2순위: 기존 크레덴셜 감지
 */
export function geminiAuthCore(): boolean {
  const credPath = findCredentials();

  if (credPath) {
    updateConfigOnAuth('detected');
    console.log(`Credentials found: ${credPath}`);
    return true;
  }

  console.log('No existing credentials found. Run "vibe gemini auth" for OAuth flow.');
  return false;
}

/**
 * Gemini 인증 (CLI 명령어용) — Antigravity OAuth 플로우
 */
export async function geminiAuth(): Promise<void> {
  console.log(`
Gemini / Antigravity Authentication

Antigravity OAuth (recommended):
  - Premium models (Gemini 3 Pro, Claude proxy)
  - Google Search, code completion
  - Scopes: cloud-platform, cclog, experimentsandconfigs
  `);

  const existing = findCredentials();
  if (existing) {
    const content = fs.readFileSync(existing, 'utf-8');
    const data = JSON.parse(content) as { scope?: string; expiry_date?: number };
    const isAntigravity = data.scope?.includes('cclog') || data.scope?.includes('experimentsandconfigs');
    const isExpired = data.expiry_date ? data.expiry_date <= Date.now() : false;

    console.log(`Existing credentials: ${existing}`);
    console.log(`Type: ${isAntigravity ? 'Antigravity' : 'Gemini CLI'}`);
    console.log(`Status: ${isExpired ? 'Expired (will auto-refresh)' : 'Valid'}`);

    if (isAntigravity && !isExpired) {
      console.log('\nAlready authenticated with Antigravity OAuth.');
      process.exit(0);
    }

    console.log('\nRe-authenticating with Antigravity OAuth...');
  }

  const success = await runOAuthFlow();

  if (success) {
    console.log(`
Auth method: Antigravity OAuth
Scopes: ${ANTIGRAVITY_SCOPES.join(', ')}

Available:
  - generateContent (chat, code generation)
  - completeCode (autocomplete)
  - fetchAvailableModels
  - SSE streaming

Status: vibe gemini status
Logout: vibe gemini logout
    `);
    process.exit(0);
  } else {
    process.exit(1);
  }
}

/**
 * Gemini 상태 확인 (환경변수 → 파일 → API Key)
 */
export function geminiStatus(): void {
  try {
    // 1. 환경변수 우선 확인
    const envStatus = getEnvVarStatus();
    if (envStatus) {
      console.log(envStatus);
      return;
    }

    // 2. 파일 기반 확인
    const credPath = findCredentials();
    if (credPath) {
      console.log(getFileCredStatus(credPath));
      return;
    }

    // 3. API Key 확인
    const apiKeyPath = getApiKeyFilePath();
    if (fs.existsSync(apiKeyPath)) {
      console.log(`\nGemini Status\n\nAuth: API Key\nKey file: ${apiKeyPath}\n`);
      return;
    }

    console.log(`
Gemini Status

No credentials found.

Authenticate:
  vibe gemini auth    (Antigravity OAuth - recommended)
  vibe gemini key     (API Key)
  .env: ANTIGRAVITY_REFRESH_TOKEN or GEMINI_OAUTH_REFRESH_TOKEN
    `);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Status check failed:', message);
  }
}

function getEnvVarStatus(): string | null {
  const config = readGlobalConfig();
  const geminiCreds = config.credentials?.gemini;
  const hasConfigOAuth = Boolean(geminiCreds?.oauthRefreshToken);
  const hasConfigApiKey = Boolean(geminiCreds?.apiKey);
  const hasEnvAntigravity = Boolean(process.env.ANTIGRAVITY_REFRESH_TOKEN);
  const hasEnvGeminiCli = Boolean(process.env.GEMINI_OAUTH_REFRESH_TOKEN);

  if (!hasConfigOAuth && !hasEnvAntigravity && !hasEnvGeminiCli) return null;

  const source = hasConfigOAuth
    ? `${geminiCreds?.oauthSource || 'OAuth'} (config.json)`
    : hasEnvAntigravity ? 'Antigravity (env)' : 'Gemini CLI (env)';

  const modelOverrides = config.models;
  const lines = [
    '\nGemini Status\n',
    `Auth: ${source}`,
    'Source: ~/.vibe/config.json',
    `Token cache: auto-managed`,
  ];
  if (hasConfigApiKey) lines.push('API Key: configured (fallback)');
  lines.push(`\nModels:`);
  lines.push(`  gemini=${modelOverrides?.gemini || process.env.GEMINI_MODEL || '(default)'}`);
  lines.push(`  geminiFlash=${modelOverrides?.geminiFlash || process.env.GEMINI_FLASH_MODEL || '(default)'}\n`);
  return lines.join('\n');
}

function getFileCredStatus(credPath: string): string {
  const content = fs.readFileSync(credPath, 'utf-8');
  const data = JSON.parse(content) as {
    expiry_date?: number;
    scope?: string;
    refresh_token?: string;
  };
  const isExpired = data.expiry_date ? data.expiry_date <= Date.now() : false;
  const hasRefresh = Boolean(data.refresh_token);
  const isAntigravity = data.scope?.includes('cclog') || data.scope?.includes('experimentsandconfigs');

  return `
Gemini Status

Auth: ${isAntigravity ? 'Antigravity OAuth' : 'Gemini CLI'}
Credentials: ${credPath}
Token: ${isExpired ? (hasRefresh ? 'Expired (auto-refresh available)' : 'Expired') : 'Valid'}
${data.expiry_date ? `Expires: ${new Date(data.expiry_date).toLocaleString()}` : ''}
Scopes: ${data.scope || '(unknown)'}

Models (env):
  GEMINI_MODEL=${process.env.GEMINI_MODEL || '(not set)'}
  GEMINI_FLASH_MODEL=${process.env.GEMINI_FLASH_MODEL || '(not set)'}
  `;
}

function getApiKeyFilePath(): string {
  return path.join(getGlobalConfigDir(), 'gemini-apikey.json');
}

/**
 * Gemini 로그아웃
 */
export function geminiLogout(): void {
  try {
    // config.json에서 Gemini credentials 제거
    const config = readGlobalConfig();
    if (config.credentials?.gemini) {
      delete config.credentials.gemini;
      writeGlobalConfig(config);
      console.log('Gemini credentials removed from ~/.vibe/config.json');
    }

    // 프로젝트 config.json도 비활성화
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

    console.log(`
Note: OAuth credentials (~/.gemini/oauth_creds.json) are not deleted.
To delete: rm ~/.gemini/oauth_creds.json
    `);
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
      description: 'Gemini / Antigravity (OAuth)',
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch { /* ignore */ }
}
