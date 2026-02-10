/**
 * GoogleAuthManager - OAuth 2.0 token management for Google APIs
 * Reuses SyncEngine's OAuth client credentials with extended scopes
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import { InterfaceLogger } from '../../interface/types.js';
import { getGlobalConfigDir } from '../../core/lib/llm/auth/ConfigManager.js';
import {
  getSyncClientId,
  getSyncClientSecret,
  SYNC_OAUTH_AUTH_URL,
  SYNC_OAUTH_TOKEN_URL,
} from '../../core/lib/sync/constants.js';
import { GoogleAuthTokens } from './google-types.js';
import { loadSyncAuth } from '../../core/lib/sync/storage.js';

const AUTH_REDIRECT_PORT = 51123;
const AUTH_REDIRECT_URI = `http://localhost:${AUTH_REDIRECT_PORT}/oauth-callback`;
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const MAX_API_RETRIES = 3;

const GOOGLE_SCOPES: readonly string[] = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export class GoogleAuthManager {
  private logger: InterfaceLogger;
  private tokenPath: string;
  private tokens: GoogleAuthTokens | null = null;

  constructor(logger: InterfaceLogger, tokenPath?: string) {
    this.logger = logger;
    this.tokenPath = tokenPath ?? path.join(getGlobalConfigDir(), 'google-tokens.json');
    this.loadTokens();
  }

  /** Check if authenticated (has valid/refreshable token) */
  isAuthenticated(): boolean {
    return this.tokens !== null && !!this.tokens.refreshToken;
  }

  /** Get valid access token (auto-refresh if expired) */
  async getAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('Google 인증이 필요합니다. 인증 URL을 확인해주세요.');
    }
    if (this.tokens.expires > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
      return this.tokens.accessToken;
    }
    return this.refreshToken();
  }

  /** Generate OAuth authorization URL for Telegram */
  getAuthUrl(): string {
    const clientId = getSyncClientId();
    const url = new URL(SYNC_OAUTH_AUTH_URL);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', AUTH_REDIRECT_URI);
    url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    return url.toString();
  }

  /** Exchange authorization code for tokens */
  async exchangeCode(code: string): Promise<void> {
    const body = this.buildTokenRequestBody(code);
    const res = await fetch(SYNC_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`토큰 교환 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as TokenResponse;
    this.updateTokens(data);
    this.logger('info', 'Google OAuth 토큰 저장 완료');
  }

  /** Authenticated fetch with 429 exponential backoff retry */
  async fetchApi(url: string, options?: RequestInit): Promise<Response> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...(options?.headers as Record<string, string>),
    };

    for (let attempt = 0; attempt < MAX_API_RETRIES; attempt++) {
      const res = await fetch(url, { ...options, headers });
      if (res.status !== 429) return res;

      const retryAfter = Number(res.headers.get('Retry-After')) || Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      this.logger('warn', `Google API 429, retry ${attempt + 1}/${MAX_API_RETRIES} after ${retryAfter}s`);
      await sleep(retryAfter * 1000 + jitter);
    }

    throw new Error('Google API 요청 한도 초과 (429). 잠시 후 다시 시도해주세요.');
  }

  /** Start local OAuth callback server */
  async startAuthFlow(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this.handleOAuthCallback(req, res, server, resolve, reject);
      });
      server.listen(AUTH_REDIRECT_PORT);
      setTimeout(() => {
        server.close();
        reject(new Error('OAuth 인증 타임아웃 (5분)'));
      }, AUTH_TIMEOUT_MS);
    });
  }

  private handleOAuthCallback(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    server: http.Server,
    resolve: (code: string) => void,
    reject: (err: Error) => void,
  ): void {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/oauth-callback') {
      res.writeHead(404).end();
      return;
    }
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<p>인증 완료. 이 창을 닫아도 됩니다.</p>');
    server.close();
    if (error) return reject(new Error(`OAuth error: ${error}`));
    if (!code) return reject(new Error('인증 코드가 없습니다'));
    resolve(code);
  }

  private async refreshToken(): Promise<string> {
    if (!this.tokens?.refreshToken) {
      throw new Error('Refresh token이 없습니다. 재인증이 필요합니다.');
    }
    const body = this.buildRefreshRequestBody();
    const res = await fetch(SYNC_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`토큰 갱신 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as TokenResponse;
    this.updateTokens(data);
    return this.tokens!.accessToken;
  }

  private buildTokenRequestBody(code: string): URLSearchParams {
    const clientId = getSyncClientId();
    const clientSecret = getSyncClientSecret();
    const body = new URLSearchParams({
      client_id: clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: AUTH_REDIRECT_URI,
    });
    if (clientSecret) body.set('client_secret', clientSecret);
    return body;
  }

  private buildRefreshRequestBody(): URLSearchParams {
    const clientId = getSyncClientId();
    const clientSecret = getSyncClientSecret();
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.tokens!.refreshToken,
      client_id: clientId,
    });
    if (clientSecret) body.set('client_secret', clientSecret);
    return body;
  }

  private updateTokens(data: TokenResponse): void {
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? this.tokens?.refreshToken ?? '',
      expires: Date.now() + data.expires_in * 1000 - TOKEN_REFRESH_MARGIN_MS,
      scopes: [...GOOGLE_SCOPES],
    };
    this.saveTokens();
  }

  private loadTokens(): void {
    // 1. Try own token file first (google-tokens.json)
    try {
      if (fs.existsSync(this.tokenPath)) {
        const content = fs.readFileSync(this.tokenPath, 'utf-8');
        this.tokens = JSON.parse(content) as GoogleAuthTokens;
        return;
      }
    } catch {
      this.logger('warn', 'Google 토큰 로드 실패');
    }

    // 2. Fallback: use sync-auth.json (from vibe sync login)
    try {
      const syncAuth = loadSyncAuth();
      if (syncAuth?.refreshToken) {
        this.tokens = {
          accessToken: syncAuth.accessToken,
          refreshToken: syncAuth.refreshToken,
          expires: syncAuth.expires,
          scopes: [...GOOGLE_SCOPES],
        };
        this.logger('info', 'sync-auth.json에서 Google 토큰 로드 완료');
      }
    } catch {
      this.logger('warn', 'sync-auth 토큰 fallback 실패');
    }
  }

  private saveTokens(): void {
    if (!this.tokens) return;
    const dir = path.dirname(this.tokenPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.tokenPath, JSON.stringify(this.tokens, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
