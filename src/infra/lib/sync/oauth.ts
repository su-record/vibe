/**
 * vibe sync — Google OAuth (drive.appdata) 플로우
 */

import http from 'http';
import crypto from 'crypto';
import { exec } from 'child_process';
import {
  getSyncClientId,
  getSyncClientSecret,
  SYNC_REDIRECT_URI,
  SYNC_REDIRECT_PATH,
  SYNC_SCOPES,
  SYNC_OAUTH_AUTH_URL,
  SYNC_OAUTH_TOKEN_URL,
  SYNC_OAUTH_USERINFO_URL,
  SYNC_OAUTH_TIMEOUT_MS,
} from './constants.js';
import { loadSyncAuth, saveSyncAuth, type SyncAuthStorage } from './storage.js';

interface PKCE {
  verifier: string;
  challenge: string;
}

interface StatePayload {
  verifier: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

function generatePKCE(): PKCE {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function encodeState(payload: StatePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeState(state: string): StatePayload {
  const normalized = state.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as StatePayload;
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${cmd} "${url}"`, (err) => {
    if (err) {
      console.warn('Could not open browser:', (err as Error).message);
      console.log('Open this URL manually:', url);
    }
  });
}

/**
 * 로그인 플로우: 브라우저 오픈 → 콜백에서 code 수신 → 토큰 교환 → 저장
 */
export async function runSyncLogin(): Promise<{ email?: string }> {
  const clientId = getSyncClientId();
  const clientSecret = getSyncClientSecret();
  const pkce = generatePKCE();

  const authUrl = new URL(SYNC_OAUTH_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', SYNC_REDIRECT_URI);
  authUrl.searchParams.set('scope', SYNC_SCOPES.join(' '));
  authUrl.searchParams.set('code_challenge', pkce.challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', encodeState({ verifier: pkce.verifier }));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  const [code, stateParam] = await new Promise<[string, string]>((resolve, reject) => {
    const port = new URL(SYNC_REDIRECT_URI).port;
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost`);
      if (url.pathname !== SYNC_REDIRECT_PATH) {
        res.writeHead(404).end();
        return;
      }
      const codeParam = url.searchParams.get('code');
      const stateParam = url.searchParams.get('state');
      const errorParam = url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<script>window.close()</script><p>로그인 완료. 이 창을 닫아도 됩니다.</p>'
      );
      server.close();
      if (errorParam) {
        reject(new Error(`OAuth error: ${errorParam}`));
        return;
      }
      if (!codeParam || !stateParam) {
        reject(new Error('Missing code or state'));
        return;
      }
      resolve([codeParam, stateParam]);
    });

    server.listen(port, () => {
      openBrowser(authUrl.toString());
    });

    setTimeout(() => {
      server.close();
      reject(new Error('OAuth timeout (5 min)'));
    }, SYNC_OAUTH_TIMEOUT_MS);
  });

  const { verifier } = decodeState(stateParam);
  const tokens = await exchangeCodeForTokens(code, verifier, clientId, clientSecret);
  const existing = loadSyncAuth();
  const encryptionKey = existing?.encryptionKey ?? crypto.randomBytes(32).toString('base64');

  const storage: SyncAuthStorage = {
    version: 1,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? '',
    expires: Date.now() + tokens.expires_in * 1000 - 60000,
    email: tokens.email,
    encryptionKey,
  };
  saveSyncAuth(storage);
  return { email: tokens.email };
}

async function exchangeCodeForTokens(
  code: string,
  verifier: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse & { email?: string }> {
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    grant_type: 'authorization_code',
    redirect_uri: SYNC_REDIRECT_URI,
    code_verifier: verifier,
  });
  if (clientSecret) body.set('client_secret', clientSecret);
  const res = await fetch(SYNC_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  const tokenPayload = (await res.json()) as TokenResponse;
  let email: string | undefined;
  const userRes = await fetch(SYNC_OAUTH_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });
  if (userRes.ok) {
    const user = (await userRes.json()) as { email?: string };
    email = user.email;
  }
  return { ...tokenPayload, email };
}

export async function refreshSyncAccessToken(): Promise<string> {
  const auth = loadSyncAuth();
  if (!auth?.refreshToken) throw new Error('Not logged in. Run: vibe sync login');
  const clientId = getSyncClientId();
  const clientSecret = getSyncClientSecret();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
    client_id: clientId,
  });
  if (clientSecret) body.set('client_secret', clientSecret);
  const res = await fetch(SYNC_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const data = (await res.json()) as TokenResponse;
  const expires = Date.now() + data.expires_in * 1000 - 60000;
  saveSyncAuth({ ...auth, accessToken: data.access_token, expires });
  return data.access_token;
}

export async function getSyncAccessToken(): Promise<string> {
  const auth = loadSyncAuth();
  if (!auth) throw new Error('Not logged in. Run: vibe sync login');
  if (auth.expires > Date.now() + 60000) return auth.accessToken;
  return refreshSyncAccessToken();
}