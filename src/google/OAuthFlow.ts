/**
 * OAuthFlow — OAuth 2.0 Authorization Code + PKCE
 *
 * - PKCE code_verifier + code_challenge (S256)
 * - State parameter: 서버 측 해시 저장, TTL 5분, 1회 사용
 * - ICallbackHandler: Local(Phase1) / SaaS(Phase6) 분기
 * - Replay 방지: state 사용 후 즉시 소멸
 */

import * as crypto from 'node:crypto';
import * as http from 'node:http';
import Database from 'better-sqlite3';
import type {
  PKCEPair,
  ICallbackHandler,
  OAuthFlowConfig,
  GoogleLogger,
} from './types.js';
import { createGoogleError } from './types.js';
import { TokenStore } from './TokenStore.js';
import { ScopeManager } from './ScopeManager.js';

const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_USERINFO_URL = 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json';
const STATE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CALLBACK_PORT = 51124;
const DEFAULT_AUTH_TIMEOUT_MS = 120_000;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

export class OAuthFlow {
  private db: Database.Database;
  private tokenStore: TokenStore;
  private scopeManager: ScopeManager;
  private config: Required<OAuthFlowConfig>;
  private logger: GoogleLogger;

  constructor(
    db: Database.Database,
    tokenStore: TokenStore,
    scopeManager: ScopeManager,
    logger: GoogleLogger,
    config: OAuthFlowConfig,
  ) {
    this.db = db;
    this.tokenStore = tokenStore;
    this.scopeManager = scopeManager;
    this.logger = logger;
    this.config = {
      clientId: config.clientId,
      clientSecret: config.clientSecret ?? '',
      callbackPort: config.callbackPort ?? DEFAULT_CALLBACK_PORT,
      authTimeoutMs: config.authTimeoutMs ?? DEFAULT_AUTH_TIMEOUT_MS,
    };
  }

  /** OAuth 인증 URL 생성 (PKCE 포함) */
  generateAuthUrl(userId: string, scopes: string[]): { url: string; state: string } {
    const pkce = this.generatePKCE();
    const state = crypto.randomBytes(32).toString('base64url');

    // State 서버 측 저장 (해시, TTL 5분, 1회 사용)
    this.saveState(state, userId, scopes, pkce.verifier);

    const redirectUri = `http://localhost:${this.config.callbackPort}/oauth-callback`;
    const url = new URL(OAUTH_AUTH_URL);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('code_challenge', pkce.challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');

    return { url: url.toString(), state };
  }

  /** 콜백 처리: code → 토큰 교환 → 저장 */
  async handleCallback(code: string, state: string): Promise<{ email?: string }> {
    const stateData = this.consumeState(state);

    const redirectUri = `http://localhost:${this.config.callbackPort}/oauth-callback`;
    const tokens = await this.exchangeCode(code, stateData.verifier, redirectUri);

    // 승인된 scope 기록
    const grantedScopes = tokens.scope?.split(' ') ?? stateData.scopes;
    this.scopeManager.grantScopes(stateData.userId, grantedScopes);

    // 토큰 암호화 저장
    this.tokenStore.save(
      stateData.userId,
      tokens.access_token,
      tokens.refresh_token ?? '',
      tokens.expires_in,
      grantedScopes,
    );

    // 부분 승인 감지
    const denied = this.scopeManager.detectDeniedScopes(stateData.scopes, grantedScopes);
    if (denied.length > 0) {
      this.logger('warn', `Scopes denied: ${denied.join(', ')}`);
    }

    // 이메일 조회
    let email: string | undefined;
    try {
      email = await this.fetchUserEmail(tokens.access_token);
    } catch {
      this.logger('warn', 'Failed to fetch user email');
    }

    this.logger('info', `OAuth completed for user ${stateData.userId}`);
    return { email };
  }

  /** 로컬 모드: 임시 HTTP 서버로 콜백 수신 */
  async startLocalAuthFlow(
    userId: string,
    scopes: string[],
  ): Promise<{ email?: string; authUrl: string }> {
    const { url, state } = this.generateAuthUrl(userId, scopes);
    const handler = new LocalCallbackServer(this.config.callbackPort, this.config.authTimeoutMs);

    try {
      const code = await handler.waitForCallback(state);
      const result = await this.handleCallback(code, state);
      return { ...result, authUrl: url };
    } finally {
      handler.close();
    }
  }

  /** 토큰 자동 갱신 (refresh token rotation) */
  async refreshTokens(userId: string): Promise<void> {
    const tokens = this.tokenStore.load(userId);
    if (!tokens) {
      throw createGoogleError('AUTH_REQUIRED',
        "Google 인증이 필요합니다. 'vibe google auth'로 인증해주세요.");
    }
    if (!tokens.refreshToken) {
      throw createGoogleError('TOKEN_REFRESH_FAILED',
        "Google 인증이 만료되었습니다. 'vibe google auth'로 재인증해주세요.");
    }

    await this.tokenStore.withRefreshMutex(userId, async () => {
      const freshTokens = this.tokenStore.load(userId);
      if (freshTokens && !this.tokenStore.isExpired(freshTokens)) {
        return freshTokens;
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: this.config.clientId,
      });
      if (this.config.clientSecret) {
        body.set('client_secret', this.config.clientSecret);
      }

      const res = await fetch(OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) {
        throw createGoogleError('TOKEN_REFRESH_FAILED',
          "Google 인증이 만료되었습니다. 'vibe google auth'로 재인증해주세요.");
      }

      const data = (await res.json()) as TokenResponse;
      const scopes = data.scope?.split(' ') ?? this.scopeManager.getGrantedScopes(userId);

      this.tokenStore.rotateToken(
        userId,
        tokens.familyId,
        tokens.generation,
        data.access_token,
        data.refresh_token ?? tokens.refreshToken,
        data.expires_in,
        scopes,
      );

      const refreshed = this.tokenStore.load(userId);
      if (!refreshed) {
        throw createGoogleError('TOKEN_REFRESH_FAILED',
          'Token data lost after refresh. Database may be corrupted.');
      }
      return refreshed;
    });
  }

  /** 유효한 access token 반환 (자동 갱신 포함) */
  async getValidAccessToken(userId: string): Promise<string> {
    const tokens = this.tokenStore.load(userId);
    if (!tokens) {
      throw createGoogleError('AUTH_REQUIRED',
        "Google 인증이 필요합니다. 'vibe google auth'로 인증해주세요.");
    }

    if (this.tokenStore.isExpired(tokens) || this.tokenStore.needsPreemptiveRefresh(tokens)) {
      await this.refreshTokens(userId);
      const refreshed = this.tokenStore.load(userId);
      if (!refreshed) {
        throw createGoogleError('TOKEN_REFRESH_FAILED', 'Token refresh failed');
      }
      return refreshed.accessToken;
    }

    return tokens.accessToken;
  }

  // ════════════════════════════════════════════════════════════
  // Private
  // ════════════════════════════════════════════════════════════

  private generatePKCE(): PKCEPair {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  private saveState(
    state: string,
    userId: string,
    scopes: string[],
    verifier: string,
  ): void {
    const stateHash = crypto.createHash('sha256').update(state).digest('hex');
    const verifierHash = crypto.createHash('sha256').update(verifier).digest('hex');
    this.db.prepare(`
      INSERT INTO oauth_states (state_hash, user_id, scopes, verifier_hash, created_at, used)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(stateHash, userId, JSON.stringify(scopes), verifierHash, Date.now());

    // raw verifier는 메모리에만 보관 (state → verifier 매핑, TTL 정리)
    this.verifierCache.set(stateHash, verifier);
    this.verifierTimestamps.set(stateHash, Date.now());
    this.startVerifierCleanup();
  }

  private consumeState(state: string): { userId: string; scopes: string[]; verifier: string } {
    const stateHash = crypto.createHash('sha256').update(state).digest('hex');
    const row = this.db.prepare(
      'SELECT * FROM oauth_states WHERE state_hash = ? AND used = 0',
    ).get(stateHash) as OAuthStateRow | undefined;

    if (!row) {
      throw createGoogleError('AUTH_REQUIRED', 'Invalid or expired OAuth state (replay attempt?)');
    }

    // TTL 체크
    if (Date.now() - row.created_at > STATE_TTL_MS) {
      this.db.prepare('DELETE FROM oauth_states WHERE state_hash = ?').run(stateHash);
      throw createGoogleError('AUTH_REQUIRED', 'OAuth state expired (5 min TTL)');
    }

    // 1회 사용 후 소멸
    this.db.prepare('UPDATE oauth_states SET used = 1 WHERE state_hash = ?').run(stateHash);

    const verifier = this.verifierCache.get(stateHash);
    if (!verifier) {
      throw createGoogleError('AUTH_REQUIRED', 'PKCE verifier not found');
    }
    this.verifierCache.delete(stateHash);

    return {
      userId: row.user_id,
      scopes: parseScopesJson(row.scopes),
      verifier,
    };
  }

  /** 임시 verifier 캐시 (state hash → verifier, TTL 기반 정리) */
  private verifierCache = new Map<string, string>();
  private verifierTimestamps = new Map<string, number>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private startVerifierCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [hash, ts] of this.verifierTimestamps) {
        if (now - ts > STATE_TTL_MS) {
          this.verifierCache.delete(hash);
          this.verifierTimestamps.delete(hash);
        }
      }
      if (this.verifierCache.size === 0 && this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
    }, 60_000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  private async exchangeCode(
    code: string,
    verifier: string,
    redirectUri: string,
  ): Promise<TokenResponse> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    if (this.config.clientSecret) {
      body.set('client_secret', this.config.clientSecret);
    }

    const res = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw createGoogleError('AUTH_REQUIRED', `Token exchange failed: ${text}`);
    }

    return (await res.json()) as TokenResponse;
  }

  private async fetchUserEmail(accessToken: string): Promise<string | undefined> {
    const res = await fetch(OAUTH_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { email?: string };
    return data.email;
  }
}

// ============================================================================
// LocalCallbackServer — ICallbackHandler 구현 (Phase 1: 로컬)
// ============================================================================

export class LocalCallbackServer implements ICallbackHandler {
  private server: http.Server | null = null;
  private port: number;
  private timeoutMs: number;

  constructor(port: number = DEFAULT_CALLBACK_PORT, timeoutMs: number = DEFAULT_AUTH_TIMEOUT_MS) {
    this.port = port;
    this.timeoutMs = timeoutMs;
  }

  get redirectUri(): string {
    return `http://localhost:${this.port}/oauth-callback`;
  }

  async waitForCallback(expectedState: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (url.pathname !== '/oauth-callback') {
          res.writeHead(404).end();
          return;
        }

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<script>window.close()</script><p>인증 완료. 이 창을 닫아도 됩니다.</p>');
        this.close();

        if (error) {
          reject(createGoogleError('AUTH_REQUIRED', `OAuth error: ${error}`));
          return;
        }
        if (!code) {
          reject(createGoogleError('AUTH_REQUIRED', '인증 코드가 없습니다'));
          return;
        }
        if (state !== expectedState) {
          reject(createGoogleError('AUTH_REQUIRED', 'State mismatch (CSRF detected)'));
          return;
        }
        resolve(code);
      });

      this.server.listen(this.port);

      setTimeout(() => {
        this.close();
        reject(createGoogleError('AUTH_REQUIRED', `OAuth 인증 타임아웃 (${this.timeoutMs / 1000}초)`));
      }, this.timeoutMs);
    });
  }

  close(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

// Internal DB row type
interface OAuthStateRow {
  state_hash: string;
  user_id: string;
  scopes: string;
  verifier_hash: string;
  created_at: number;
  used: number;
}

/** JSON.parse + 런타임 검증: scopes 배열 파싱 */
function parseScopesJson(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected array, got ${typeof parsed}`);
    }
    if (!parsed.every((s): s is string => typeof s === 'string')) {
      throw new Error('Array contains non-string elements');
    }
    return parsed;
  } catch (err) {
    throw createGoogleError('UNKNOWN_ERROR',
      `OAuth scopes 파싱 실패: ${err instanceof Error ? err.message : String(err)}`);
  }
}
