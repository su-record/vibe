/**
 * Gemini / Antigravity 인증 관리
 *
 * 인증 순서: antigravity → gemini-cli → apikey
 *
 * 환경변수 우선:
 *   - ANTIGRAVITY_REFRESH_TOKEN → antigravity OAuth (자동 credential resolve)
 *   - GEMINI_OAUTH_REFRESH_TOKEN → gemini-cli OAuth (자동 credential resolve)
 *   - GEMINI_API_KEY → API Key
 *
 * Fallback:
 *   - ~/.gemini/oauth_creds.json 파일 기반 인증 (기존 호환)
 *
 * 갱신된 토큰은 {configDir}/oauth/gemini-{source}.json 에 캐시
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

import { warnLog } from '../utils.js';
import { getAuthProfileManager } from '../llm/auth/AuthProfileManager.js';
import { getGlobalConfigDir } from '../llm/auth/ConfigManager.js';
import {
  getGeminiApiKey as getGeminiApiKeyFromConfig,
  getGeminiOAuthRefreshToken,
  readGlobalConfig,
} from '../config/GlobalConfigManager.js';
import {
  ANTIGRAVITY_CLIENT_ID,
  ANTIGRAVITY_CLIENT_SECRET,
  GEMINI_CLI_CLIENT_ID,
  GEMINI_CLI_CLIENT_SECRET,
  GOOGLE_TOKEN_URL,
  LOAD_ENDPOINTS,
  API_VERSION,
  ANTIGRAVITY_HEADERS,
  ANTIGRAVITY_METADATA,
  DEFAULT_PROJECT_ID,
} from './constants.js';
import type { AuthInfo, GeminiAuthMethod } from './types.js';

// 인증 순서: antigravity → gemini-cli → apikey
const AUTH_ORDER: GeminiAuthMethod[] = ['antigravity', 'gemini-cli', 'apikey'];

// 환경변수 키 매핑
const ENV_REFRESH_TOKEN_KEYS: Record<string, string> = {
  'antigravity': 'ANTIGRAVITY_REFRESH_TOKEN',
  'gemini-cli': 'GEMINI_OAUTH_REFRESH_TOKEN',
};

// =============================================
// 토큰 캐시 (환경변수 기반 인증용)
// =============================================

interface CachedTokens {
  accessToken: string;
  refreshToken: string;
  expires: number;
  projectId?: string;
  clientId: string;
  clientSecret: string;
}

function getOAuthCacheDir(): string {
  return path.join(getGlobalConfigDir(), 'oauth');
}

function getOAuthCachePath(source: string): string {
  return path.join(getOAuthCacheDir(), `gemini-${source}.json`);
}

function loadCachedTokens(source: string): CachedTokens | null {
  try {
    const cachePath = getOAuthCachePath(source);
    if (!fs.existsSync(cachePath)) return null;
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CachedTokens;
  } catch {
    return null;
  }
}

function saveCachedTokens(source: string, tokens: CachedTokens): void {
  try {
    const dir = getOAuthCacheDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getOAuthCachePath(source), JSON.stringify(tokens, null, 2), { mode: 0o600 });
  } catch {
    warnLog('Failed to cache Gemini OAuth tokens', { source });
  }
}

/**
 * API Key 가져오기 (config.json 우선 → 환경변수 fallback)
 */
export function getApiKeyFromConfig(): string | null {
  const configKey = getGeminiApiKeyFromConfig();
  if (configKey) return configKey;
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  return null;
}

// =============================================
// OAuth 크레덴셜 탐색
// =============================================

/** 크레덴셜 검색 경로 */
const CREDENTIAL_PATHS = [
  path.join(os.homedir(), '.gemini', 'oauth_creds.json'),
  path.join(os.homedir(), '.config', 'gemini-cli', 'oauth_creds.json'),
];

interface OAuthCredentials {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_uri?: string;
  scope?: string;
}

function isOAuthCredentials(data: unknown): data is OAuthCredentials {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.access_token === 'string' &&
    typeof obj.refresh_token === 'string' &&
    typeof obj.expiry_date === 'number'
  );
}

/**
 * OAuth 크레덴셜 탐색 (read-only)
 * Symlink 거부, 소유자 확인 (macOS/Linux)
 */
function findOAuthCredentials(): OAuthCredentials | null {
  for (const credPath of CREDENTIAL_PATHS) {
    try {
      const stat = fs.lstatSync(credPath);
      if (stat.isSymbolicLink() || !stat.isFile()) continue;

      // 소유자 확인 (macOS/Linux)
      if (process.platform !== 'win32') {
        const uid = process.getuid?.();
        if (uid !== undefined && stat.uid !== uid) continue;
        const mode = stat.mode & 0o777;
        if ((mode & 0o077) !== 0) continue;
      }

      const content = fs.readFileSync(credPath, 'utf-8');
      const data: unknown = JSON.parse(content);
      if (!isOAuthCredentials(data)) continue;
      return data;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * 어떤 OAuth client로 발급된 토큰인지 판별
 * scope에 cclog/experimentsandconfigs가 있으면 Antigravity
 */
function detectOAuthSource(creds: OAuthCredentials): 'antigravity' | 'gemini-cli' {
  const scope = creds.scope || '';
  if (scope.includes('cclog') || scope.includes('experimentsandconfigs')) {
    return 'antigravity';
  }
  return 'gemini-cli';
}

// =============================================
// 토큰 갱신
// =============================================

async function refreshOAuthToken(
  creds: OAuthCredentials,
  clientId: string,
  clientSecret: string,
): Promise<OAuthCredentials | null> {
  try {
    const tokenUri = creds.token_uri || GOOGLE_TOKEN_URL;
    const response = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') return null;

    const result = data as Record<string, unknown>;
    const newAccessToken = result.access_token;
    if (typeof newAccessToken !== 'string') return null;

    const expiresIn = typeof result.expires_in === 'number' ? result.expires_in : 3600;
    const newCreds: OAuthCredentials = {
      access_token: newAccessToken,
      refresh_token: creds.refresh_token,
      expiry_date: Date.now() + expiresIn * 1000,
      token_uri: tokenUri,
      scope: creds.scope,
    };

    // 갱신된 토큰을 파일에 저장
    const credPath = CREDENTIAL_PATHS[0];
    const dir = path.dirname(credPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(credPath, JSON.stringify(newCreds, null, 2), { mode: 0o600 });

    return newCreds;
  } catch {
    return null;
  }
}

// =============================================
// loadCodeAssist — projectId 획득
// =============================================

/**
 * loadCodeAssist API로 projectId 획득
 * Production → Autopush → Daily 순서로 시도
 *
 * Antigravity IDE 방식:
 * 1차 호출 → projectId 획득
 * 2차 호출 → cloudaicompanionProject 포함해서 paidTier 확인
 */
async function loadCodeAssistProjectId(accessToken: string): Promise<string | null> {
  for (const endpoint of LOAD_ENDPOINTS) {
    try {
      const url = `${endpoint}/${API_VERSION}:loadCodeAssist`;
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...ANTIGRAVITY_HEADERS,
      };

      // 1차: 기본 projectId로 요청
      const firstResponse = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          metadata: ANTIGRAVITY_METADATA,
          cloudaicompanionProject: DEFAULT_PROJECT_ID,
        }),
      });

      if (!firstResponse.ok) continue;

      const firstData: unknown = await firstResponse.json();
      if (!firstData || typeof firstData !== 'object') continue;

      const firstResult = firstData as Record<string, unknown>;
      const projectId = typeof firstResult.cloudaicompanionProject === 'string'
        ? firstResult.cloudaicompanionProject
        : null;

      if (!projectId) continue;

      // paidTier가 있으면 바로 반환
      if (firstResult.paidTier) return projectId;

      // paidTier 없으면 2차 호출 (획득한 projectId 포함)
      const secondResponse = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          metadata: ANTIGRAVITY_METADATA,
          cloudaicompanionProject: projectId,
        }),
      });

      if (!secondResponse.ok) return projectId;

      const secondData: unknown = await secondResponse.json();
      if (!secondData || typeof secondData !== 'object') return projectId;

      const secondResult = secondData as Record<string, unknown>;
      return typeof secondResult.cloudaicompanionProject === 'string'
        ? secondResult.cloudaicompanionProject
        : projectId;
    } catch {
      continue;
    }
  }
  return null;
}

// =============================================
// 환경변수 기반 인증 (sutory 패턴)
// =============================================

/** credential 자동 해석 (source별 clientId/clientSecret) */
function resolveCredentials(source: GeminiAuthMethod): { clientId: string; clientSecret: string } {
  if (source === 'antigravity') {
    return { clientId: ANTIGRAVITY_CLIENT_ID, clientSecret: ANTIGRAVITY_CLIENT_SECRET };
  }

  // gemini-cli: 환경변수 → oauth_client.json → 하드코딩 fallback
  const envId = process.env['GEMINI_CLI_OAUTH_CLIENT_ID'];
  const envSecret = process.env['GEMINI_CLI_OAUTH_CLIENT_SECRET'];
  if (envId) return { clientId: envId, clientSecret: envSecret ?? '' };

  try {
    const clientCredsPath = path.join(os.homedir(), '.gemini', 'oauth_client.json');
    if (fs.existsSync(clientCredsPath)) {
      const data = JSON.parse(fs.readFileSync(clientCredsPath, 'utf-8')) as Record<string, unknown>;
      if (typeof data.client_id === 'string') {
        return { clientId: data.client_id, clientSecret: (data.client_secret as string) ?? '' };
      }
    }
  } catch { /* fallback */ }

  return { clientId: GEMINI_CLI_CLIENT_ID, clientSecret: GEMINI_CLI_CLIENT_SECRET };
}

/** 환경변수 refresh token → 토큰 갱신 → 캐시 → AuthInfo 반환 */
async function tryAuthWithEnvToken(
  refreshToken: string,
  source: GeminiAuthMethod,
): Promise<AuthInfo | null> {
  const { clientId, clientSecret } = resolveCredentials(source);

  // 캐시 확인: 같은 refresh token이고 아직 유효하면 캐시 사용
  const cached = loadCachedTokens(source);
  if (cached && cached.refreshToken === refreshToken && cached.expires > Date.now() + 5 * 60 * 1000) {
    return {
      type: source,
      accessToken: cached.accessToken,
      projectId: cached.projectId,
      refreshToken: cached.refreshToken,
      expiryDate: cached.expires,
      clientId: cached.clientId,
      clientSecret: cached.clientSecret,
    };
  }

  // 토큰 갱신
  const fakeCreds: OAuthCredentials = {
    access_token: '',
    refresh_token: refreshToken,
    expiry_date: 0,
  };
  const refreshed = await refreshOAuthToken(fakeCreds, clientId, clientSecret);
  if (!refreshed) return null;

  // projectId 탐색
  const projectId = cached?.projectId || await loadCodeAssistProjectId(refreshed.access_token);

  // 캐시 저장
  saveCachedTokens(source, {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expires: refreshed.expiry_date,
    projectId: projectId || undefined,
    clientId,
    clientSecret,
  });

  return {
    type: source,
    accessToken: refreshed.access_token,
    projectId: projectId || undefined,
    refreshToken: refreshed.refresh_token,
    expiryDate: refreshed.expiry_date,
    clientId,
    clientSecret,
  };
}

// =============================================
// 개별 인증 방식 시도
// =============================================

async function tryAuthMethod(method: GeminiAuthMethod): Promise<AuthInfo | null> {
  switch (method) {
    case 'antigravity':
      return tryAntigravityAuth();
    case 'gemini-cli':
      return tryGeminiCliAuth();
    case 'apikey': {
      const apiKey = getApiKeyFromConfig();
      return apiKey ? { type: 'apikey', apiKey } : null;
    }
    default:
      return null;
  }
}

/** Antigravity 인증: config.json → 환경변수 → 파일 기반 */
async function tryAntigravityAuth(): Promise<AuthInfo | null> {
  // 0. config.json 우선
  const globalCfg = readGlobalConfig();
  if (globalCfg.credentials?.gemini?.oauthSource === 'antigravity' && globalCfg.credentials.gemini.oauthRefreshToken) {
    return tryAuthWithEnvToken(globalCfg.credentials.gemini.oauthRefreshToken, 'antigravity');
  }

  // 1. 환경변수 fallback
  const envToken = process.env[ENV_REFRESH_TOKEN_KEYS['antigravity']];
  if (envToken) {
    return tryAuthWithEnvToken(envToken, 'antigravity');
  }

  // 2. 파일 기반 fallback
  const creds = findOAuthCredentials();
  if (!creds || detectOAuthSource(creds) !== 'antigravity') return null;

  return tryAuthWithFileCreds(creds, 'antigravity', ANTIGRAVITY_CLIENT_ID, ANTIGRAVITY_CLIENT_SECRET);
}

/** Gemini CLI 인증: config.json → 환경변수 → 파일 기반 */
async function tryGeminiCliAuth(): Promise<AuthInfo | null> {
  // 0. config.json 우선 (oauthSource가 gemini-cli이거나 미지정인 경우)
  const cfgToken = getGeminiOAuthRefreshToken();
  const cfgSource = readGlobalConfig().credentials?.gemini?.oauthSource;
  if (cfgToken && cfgSource !== 'antigravity') {
    return tryAuthWithEnvToken(cfgToken, 'gemini-cli');
  }

  // 1. 환경변수 fallback
  const envToken = process.env[ENV_REFRESH_TOKEN_KEYS['gemini-cli']];
  if (envToken) {
    return tryAuthWithEnvToken(envToken, 'gemini-cli');
  }

  // 2. 파일 기반 fallback
  const creds = findOAuthCredentials();
  if (!creds) return null;

  const { clientId, clientSecret } = resolveCredentials('gemini-cli');
  return tryAuthWithFileCreds(creds, 'gemini-cli', clientId, clientSecret);
}

/** 파일 기반 크레덴셜로 인증 (기존 호환) */
async function tryAuthWithFileCreds(
  creds: OAuthCredentials,
  source: GeminiAuthMethod,
  clientId: string,
  clientSecret: string,
): Promise<AuthInfo | null> {
  let token = creds.access_token;

  if (creds.expiry_date <= Date.now() + 5 * 60 * 1000) {
    if (!creds.refresh_token) return null;
    const refreshed = await refreshOAuthToken(creds, clientId, clientSecret);
    if (!refreshed) return null;
    token = refreshed.access_token;
  }

  const projectId = await loadCodeAssistProjectId(token);

  return {
    type: source,
    accessToken: token,
    projectId: projectId || undefined,
    refreshToken: creds.refresh_token,
    tokenUri: creds.token_uri || GOOGLE_TOKEN_URL,
    expiryDate: creds.expiry_date,
    clientId,
    clientSecret,
  };
}

// =============================================
// Public API
// =============================================

/**
 * 인증 방식 확인 (antigravity → gemini-cli → apikey)
 */
export async function getAuthInfo(): Promise<AuthInfo> {
  for (const method of AUTH_ORDER) {
    const auth = await tryAuthMethod(method);
    if (auth) return auth;
  }

  throw new Error(
    'Gemini credentials not found. Tried: antigravity, gemini-cli, apikey. ' +
    'Run: gemini (OAuth) or vibe gemini key <key> (API Key)'
  );
}

/**
 * Auth Profile 기반 성공/실패 마킹 (optional)
 */
export async function markAuthSuccess(profileId: string): Promise<void> {
  try {
    const manager = getAuthProfileManager();
    await manager.markSuccess(profileId);
  } catch {
    // Profile rotation is optional
  }
}

export async function markAuthFailure(profileId: string, errorMsg?: string): Promise<void> {
  try {
    const manager = getAuthProfileManager();
    await manager.markFailure(profileId, errorMsg);
  } catch {
    // Profile rotation is optional
  }
}
