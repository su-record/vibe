/**
 * GPT OAuth 인증 (OpenAI Codex CLI 방식)
 * PKCE를 사용한 OpenAI OAuth 인증
 */

import http from 'http';
import crypto from 'crypto';
import { exec } from 'child_process';

import {
  GPT_CLIENT_ID,
  GPT_AUTHORIZE_URL,
  GPT_TOKEN_URL,
  GPT_REDIRECT_URI,
  GPT_SCOPE,
  JWT_CLAIM_PATH,
} from './gpt-constants.js';

import * as storage from './gpt-storage.js';
import type { GptAccount } from './gpt-storage.js';

// Types
interface PKCE {
  verifier: string;
  challenge: string;
}

interface AuthorizationUrlResult {
  url: string;
  verifier: string;
  state: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in?: number;
}

interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
  expires: number;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  expires: number;
  email: string;
  accountId?: string;
}

interface ValidAccessToken {
  accessToken: string;
  email: string;
  accountId?: string;
}

interface JWTPayload {
  email?: string;
  sub?: string;
  [key: string]: unknown;
}

/**
 * PKCE 코드 생성 (OpenAI 스펙: S256)
 */
function generatePKCE(): PKCE {
  // code_verifier: 43-128자의 랜덤 문자열
  const verifier = crypto.randomBytes(32).toString('base64url');

  // code_challenge: verifier의 SHA256 해시 (base64url)
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');

  return { verifier, challenge };
}

/**
 * 랜덤 state 생성
 */
function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * JWT 디코딩 (서명 검증 없이)
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(decoded) as JWTPayload;
  } catch { /* ignore: optional operation */
    return null;
  }
}

/**
 * JWT에서 이메일 추출
 */
export function extractEmailFromToken(token: string): string | null {
  const payload = decodeJWT(token);
  if (!payload) return null;
  return payload.email || payload.sub || null;
}

/**
 * JWT에서 ChatGPT 계정 ID 추출
 */
export function extractAccountId(token: string): string | null {
  const payload = decodeJWT(token);
  if (!payload) return null;

  // OpenAI 토큰 클레임 경로에서 계정 ID 추출
  const authClaim = payload[JWT_CLAIM_PATH] as { organization_id?: string; organizations?: Array<{ organization_id: string }> } | undefined;
  if (authClaim && authClaim.organization_id) {
    return authClaim.organization_id;
  }

  // 또는 organizations 배열에서
  if (authClaim && authClaim.organizations && authClaim.organizations.length > 0) {
    return authClaim.organizations[0].organization_id;
  }

  return null;
}

/**
 * 토큰 만료 시간 계산
 */
function calculateTokenExpiry(startTime: number, expiresIn: number): number {
  return startTime + (expiresIn * 1000) - 60000; // 1분 여유
}

/**
 * OAuth 인증 URL 생성
 */
export function createAuthorizationUrl(): AuthorizationUrlResult {
  const pkce = generatePKCE();
  const state = generateState();

  const url = new URL(GPT_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', GPT_CLIENT_ID);
  url.searchParams.set('redirect_uri', GPT_REDIRECT_URI);
  url.searchParams.set('scope', GPT_SCOPE);
  url.searchParams.set('code_challenge', pkce.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  // Codex CLI 특수 파라미터
  url.searchParams.set('id_token_add_organizations', 'true');
  url.searchParams.set('codex_cli_simplified_flow', 'true');
  url.searchParams.set('originator', 'codex_cli_rs');

  return {
    url: url.toString(),
    verifier: pkce.verifier,
    state,
  };
}

/**
 * Authorization code를 토큰으로 교환
 */
export async function exchangeCodeForTokens(code: string, verifier: string): Promise<OAuthTokens> {
  const startTime = Date.now();

  const response = await fetch(GPT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: GPT_CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: GPT_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json() as TokenResponse;

  if (!payload.access_token || !payload.refresh_token) {
    throw new Error('Token response missing required fields.');
  }

  // 이메일 및 계정 ID 추출
  const email = extractEmailFromToken(payload.id_token || payload.access_token);
  const accountId = extractAccountId(payload.id_token || payload.access_token);

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    idToken: payload.id_token,
    expires: calculateTokenExpiry(startTime, payload.expires_in || 3600),
    email: email || 'unknown',
    accountId: accountId || undefined,
  };
}

/**
 * 액세스 토큰 갱신
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshedTokens> {
  const startTime = Date.now();

  const response = await fetch(GPT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: GPT_CLIENT_ID,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json() as TokenResponse;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || refreshToken,
    expires: calculateTokenExpiry(startTime, payload.expires_in || 3600),
  };
}

/**
 * 로컬 서버로 OAuth 콜백 처리
 */
export function startOAuthFlow(): Promise<OAuthTokens> {
  return new Promise((resolve, reject) => {
    const auth = createAuthorizationUrl();
    let server: http.Server | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let isResolved = false;

    // 안전하게 서버 종료 (Windows libuv 핸들 충돌 방지)
    const closeServer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (server) {
        const serverToClose = server;
        server = null; // 먼저 null로 설정하여 중복 호출 방지

        // Windows에서 libuv 핸들 충돌 방지를 위해 충분한 지연 후 종료
        setTimeout(() => {
          try {
            // closeAllConnections가 있으면 먼저 호출
            if ('closeAllConnections' in serverToClose) {
              (serverToClose as http.Server & { closeAllConnections: () => void }).closeAllConnections();
            }
            // 서버 종료 (에러 무시)
            serverToClose.close(() => {});
          } catch {
            // 이미 닫힌 경우 무시
          }
        }, 100);
      }
    };

    // 콜백 서버 시작 (포트 1455 - Codex CLI와 동일)
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', 'http://localhost:1455');

      if (url.pathname === '/auth/callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>Authentication Failed</h1>
                <p>Error: ${error}</p>
                <p>${errorDescription || ''}</p>
                <p>Please close this window and try again.</p>
              </body>
            </html>
          `);
          if (!isResolved) {
            isResolved = true;
            closeServer();
            reject(new Error(`OAuth error: ${error} - ${errorDescription || ''}`));
          }
          return;
        }

        // state 검증
        if (state !== auth.state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>Authentication Failed</h1>
                <p>State mismatch - possible CSRF attack</p>
              </body>
            </html>
          `);
          if (!isResolved) {
            isResolved = true;
            closeServer();
            reject(new Error('State mismatch'));
          }
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>Authentication Failed</h1>
                <p>Authorization code missing.</p>
              </body>
            </html>
          `);
          if (!isResolved) {
            isResolved = true;
            closeServer();
            reject(new Error('Authorization code missing'));
          }
          return;
        }

        try {
          const tokens = await exchangeCodeForTokens(code, auth.verifier);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>Authentication Successful</title></head>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>Authentication Successful!</h1>
                <p>Logged in as ${tokens.email}.</p>
                <p>You may close this window.</p>
                <script>setTimeout(() => window.close(), 2000);</script>
              </body>
            </html>
          `);

          if (!isResolved) {
            isResolved = true;
            closeServer();
            resolve(tokens);
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>Authentication Failed</h1>
                <p>${(err as Error).message}</p>
              </body>
            </html>
          `);
          if (!isResolved) {
            isResolved = true;
            closeServer();
            reject(err);
          }
        }
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    // Keep-alive 비활성화
    server.keepAliveTimeout = 0;
    server.headersTimeout = 5000;

    server.listen(1455, 'localhost', () => {
      console.log('\nOpening OpenAI login page in browser...\n');
      console.log(`Auth URL: ${auth.url}\n`);

      // 브라우저 열기
      const platform = process.platform;

      if (platform === 'darwin') {
        exec(`open "${auth.url}"`);
      } else if (platform === 'win32') {
        exec(`start "" "${auth.url}"`);
      } else {
        exec(`xdg-open "${auth.url}"`);
      }
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (!isResolved) {
        isResolved = true;
        if (err.code === 'EADDRINUSE') {
          reject(new Error('Port 1455 is already in use. Check if another auth process is running.'));
        } else {
          reject(err);
        }
      }
    });

    // 5분 타임아웃
    timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        closeServer();
        reject(new Error('Authentication timeout (5 minutes)'));
      }
    }, 5 * 60 * 1000);
  });
}

/**
 * 유효한 액세스 토큰 가져오기 (필요시 갱신)
 */
export async function getValidAccessToken(): Promise<ValidAccessToken> {
  const account = storage.getActiveAccount();

  if (!account) {
    throw new Error('No authenticated GPT account. Run vibe gpt auth to login.');
  }

  // 토큰이 만료되었으면 갱신
  if (storage.isTokenExpired(account)) {
    console.log('Refreshing GPT access token...');
    const newTokens = await refreshAccessToken(account.refreshToken);
    storage.updateAccessToken(
      account.email,
      newTokens.accessToken,
      newTokens.refreshToken,
      newTokens.expires
    );
    return {
      accessToken: newTokens.accessToken,
      email: account.email,
      accountId: account.accountId,
    };
  }

  return {
    accessToken: account.accessToken,
    email: account.email,
    accountId: account.accountId,
  };
}
