/**
 * Gemini OAuth 인증 (Antigravity 방식)
 * Google OAuth + PKCE를 사용한 Gemini 구독 인증
 */

import http from 'http';
import crypto from 'crypto';
import { exec } from 'child_process';

import {
  ANTIGRAVITY_CLIENT_ID,
  ANTIGRAVITY_CLIENT_SECRET,
  ANTIGRAVITY_REDIRECT_URI,
  ANTIGRAVITY_SCOPES,
  ANTIGRAVITY_ENDPOINTS,
  ANTIGRAVITY_HEADERS,
  ANTIGRAVITY_DEFAULT_PROJECT_ID,
} from './gemini-constants.js';

import * as storage from './gemini-storage.js';

// Types
interface PKCE {
  verifier: string;
  challenge: string;
}

interface StatePayload {
  verifier: string;
  projectId: string;
}

interface AuthorizationUrlResult {
  url: string;
  verifier: string;
  projectId: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface UserInfo {
  email?: string;
}

interface LoadCodeAssistResponse {
  cloudaicompanionProject?: string | { id?: string };
}

interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
  expires: number;
}

export interface GeminiOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expires: number;
  email?: string;
  projectId: string;
}

interface ValidAccessToken {
  accessToken: string;
  email: string;
  projectId?: string;
}

/**
 * PKCE 코드 생성
 */
function generatePKCE(): PKCE {
  // code_verifier: 43-128자의 랜덤 문자열
  const verifier = crypto.randomBytes(32).toString('base64url');

  // code_challenge: verifier의 SHA256 해시
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');

  return { verifier, challenge };
}

/**
 * OAuth state 인코딩
 */
function encodeState(payload: StatePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * OAuth state 디코딩
 */
function decodeState(state: string): StatePayload {
  const normalized = state.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json) as StatePayload;
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
export function createAuthorizationUrl(projectId: string = ''): AuthorizationUrlResult {
  const pkce = generatePKCE();

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', ANTIGRAVITY_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', ANTIGRAVITY_REDIRECT_URI);
  url.searchParams.set('scope', ANTIGRAVITY_SCOPES.join(' '));
  url.searchParams.set('code_challenge', pkce.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', encodeState({ verifier: pkce.verifier, projectId: projectId || '' }));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');

  return {
    url: url.toString(),
    verifier: pkce.verifier,
    projectId: projectId || '',
  };
}

/**
 * Authorization code를 토큰으로 교환
 */
export async function exchangeCodeForTokens(code: string, state: string): Promise<GeminiOAuthTokens> {
  const { verifier, projectId } = decodeState(state);
  const startTime = Date.now();

  // 토큰 요청
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: ANTIGRAVITY_CLIENT_ID,
      client_secret: ANTIGRAVITY_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: ANTIGRAVITY_REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  const tokenPayload = await tokenResponse.json() as TokenResponse;

  // 사용자 정보 가져오기
  const userInfoResponse = await fetch(
    'https://www.googleapis.com/oauth2/v1/userinfo?alt=json',
    {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    }
  );

  const userInfo: UserInfo = userInfoResponse.ok ? await userInfoResponse.json() as UserInfo : {};

  // 프로젝트 ID 가져오기
  let effectiveProjectId = projectId;
  if (!effectiveProjectId) {
    effectiveProjectId = await fetchProjectId(tokenPayload.access_token);
  }

  return {
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token,
    expires: calculateTokenExpiry(startTime, tokenPayload.expires_in),
    email: userInfo.email,
    projectId: effectiveProjectId || ANTIGRAVITY_DEFAULT_PROJECT_ID,
  };
}

/**
 * Antigravity 프로젝트 ID 가져오기
 */
export async function fetchProjectId(accessToken: string): Promise<string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'User-Agent': 'google-api-nodejs-client/9.15.1',
    'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
    'Client-Metadata': ANTIGRAVITY_HEADERS['Client-Metadata'],
  };

  for (const endpoint of ANTIGRAVITY_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}/v1internal:loadCodeAssist`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          metadata: {
            ideType: 'IDE_UNSPECIFIED',
            platform: 'PLATFORM_UNSPECIFIED',
            pluginType: 'GEMINI',
          },
        }),
      });

      if (!response.ok) continue;

      const data = await response.json() as LoadCodeAssistResponse;
      if (typeof data.cloudaicompanionProject === 'string' && data.cloudaicompanionProject) {
        return data.cloudaicompanionProject;
      }
      if (typeof data.cloudaicompanionProject === 'object' && data.cloudaicompanionProject?.id) {
        return data.cloudaicompanionProject.id;
      }
    } catch { /* ignore: optional operation */
      // 다음 엔드포인트 시도
    }
  }

  return '';
}

/**
 * 액세스 토큰 갱신
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshedTokens> {
  const startTime = Date.now();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: ANTIGRAVITY_CLIENT_ID,
      client_secret: ANTIGRAVITY_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const payload = await response.json() as TokenResponse;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || refreshToken,
    expires: calculateTokenExpiry(startTime, payload.expires_in),
  };
}

/**
 * 로컬 서버로 OAuth 콜백 처리
 */
export function startOAuthFlow(): Promise<GeminiOAuthTokens> {
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

    // 콜백 서버 시작
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:51121`);

      if (url.pathname === '/oauth-callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>Authentication Failed</h1>
                <p>Error: ${error}</p>
                <p>Please close this window and try again.</p>
              </body>
            </html>
          `);
          if (!isResolved) {
            isResolved = true;
            closeServer();
            reject(new Error(`OAuth error: ${error}`));
          }
          return;
        }

        if (!code || !state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>Authentication Failed</h1>
                <p>Required parameters missing.</p>
              </body>
            </html>
          `);
          if (!isResolved) {
            isResolved = true;
            closeServer();
            reject(new Error('Required parameters missing'));
          }
          return;
        }

        try {
          const tokens = await exchangeCodeForTokens(code, state);

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

    // Keep-alive 비활성화로 연결 빨리 닫기
    server.keepAliveTimeout = 0;
    server.headersTimeout = 5000;

    server.listen(51121, 'localhost', () => {
      console.log('\nOpening Google login page in browser...\n');

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
          reject(new Error('Port 51121 is already in use. Check if another auth process is running.'));
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
    throw new Error('No authenticated Gemini account. Run vibe gemini auth to login.');
  }

  // 토큰이 만료되었으면 갱신
  if (storage.isTokenExpired(account)) {
    console.log('Refreshing access token...');
    const newTokens = await refreshAccessToken(account.refreshToken);
    storage.updateAccessToken(account.email, newTokens.accessToken, newTokens.expires);
    return {
      accessToken: newTokens.accessToken,
      email: account.email,
      projectId: account.projectId,
    };
  }

  return {
    accessToken: account.accessToken,
    email: account.email,
    projectId: account.projectId,
  };
}
