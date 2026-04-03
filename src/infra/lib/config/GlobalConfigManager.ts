/**
 * GlobalConfigManager — ~/.vibe/config.json 통합 관리
 *
 * 모든 설정(credentials, channels, models, settings)을 하나의 파일로 관리.
 * 플랫폼 무관 ~/.vibe/ 디렉토리 사용.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { GlobalVibeConfig } from '../../../cli/types.js';

// ─── Constants ──────────────────────────────────────────────────────

const VIBE_DIR_NAME = '.vibe';
const CONFIG_FILE_NAME = 'config.json';
const FILE_PERMISSIONS = 0o600;
const DIR_PERMISSIONS = 0o700;

// ─── In-memory cache ────────────────────────────────────────────────

let cachedConfig: GlobalVibeConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5_000;

function invalidateCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

// ─── Path helpers ───────────────────────────────────────────────────

/** ~/.vibe/ (플랫폼 무관 통일) */
export function getVibeDir(): string {
  return path.join(os.homedir(), VIBE_DIR_NAME);
}

/** ~/.vibe/config.json */
export function getGlobalConfigPath(): string {
  return path.join(getVibeDir(), CONFIG_FILE_NAME);
}

// ─── Read / Write ───────────────────────────────────────────────────

function createDefaultConfig(): GlobalVibeConfig {
  return { version: '1' };
}

export function readGlobalConfig(): GlobalVibeConfig {
  const now = Date.now();
  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const configPath = getGlobalConfigPath();
  try {
    if (!fs.existsSync(configPath)) {
      const defaultCfg = createDefaultConfig();
      cachedConfig = defaultCfg;
      cacheTimestamp = now;
      return defaultCfg;
    }
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') {
      return createDefaultConfig();
    }
    const config = parsed as GlobalVibeConfig;
    if (!config.version) {
      config.version = '1';
    }
    cachedConfig = config;
    cacheTimestamp = now;
    return config;
  } catch {
    return createDefaultConfig();
  }
}

export function writeGlobalConfig(config: GlobalVibeConfig): void {
  const vibeDir = getVibeDir();
  if (!fs.existsSync(vibeDir)) {
    fs.mkdirSync(vibeDir, { recursive: true, mode: DIR_PERMISSIONS });
  }
  const configPath = getGlobalConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: FILE_PERMISSIONS });
  invalidateCache();
}

// ─── Patch (deep merge) ─────────────────────────────────────────────

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function deepMerge<T extends Record<string, unknown>>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as Array<keyof T>) {
    const srcVal = source[key];
    if (srcVal === undefined) continue;

    const tgtVal = target[key];
    if (
      tgtVal && typeof tgtVal === 'object' && !Array.isArray(tgtVal) &&
      srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)
    ) {
      result[key] = deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as DeepPartial<Record<string, unknown>>,
      ) as T[keyof T];
    } else {
      result[key] = srcVal as T[keyof T];
    }
  }
  return result;
}

export function patchGlobalConfig(patch: DeepPartial<GlobalVibeConfig>): void {
  const current = readGlobalConfig();
  const merged = deepMerge(current as unknown as Record<string, unknown>, patch as unknown as DeepPartial<Record<string, unknown>>);
  merged.version = '1';
  writeGlobalConfig(merged as unknown as GlobalVibeConfig);
}

// ─── Project config + layered merge ────────────────────────────────

/** .claude/vibe/config.json (프로젝트별 설정) */
export function getProjectConfigPath(projectDir: string): string {
  return path.join(projectDir, '.claude', 'vibe', 'config.json');
}

function readProjectConfig(projectDir: string): Record<string, unknown> {
  const configPath = getProjectConfigPath(projectDir);
  try {
    if (!fs.existsSync(configPath)) return {};
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * 다중 계층 설정 병합: 글로벌(~/.vibe) + 프로젝트(.claude/vibe)
 * 우선순위: 프로젝트 > 글로벌 (프로젝트 설정이 글로벌을 덮어씀)
 * credentials는 글로벌 전용 — 프로젝트에서 덮어쓰지 않음.
 */
export function resolveConfig(projectDir: string): GlobalVibeConfig {
  const global = readGlobalConfig() as unknown as Record<string, unknown>;
  const project = readProjectConfig(projectDir);

  if (Object.keys(project).length === 0) {
    return global as unknown as GlobalVibeConfig;
  }

  // credentials는 글로벌 전용이므로 프로젝트에서 제거 후 병합
  const { credentials: _ignored, ...projectWithoutCreds } = project;

  const merged = deepMerge(
    global,
    projectWithoutCreds as DeepPartial<Record<string, unknown>>,
  );
  merged.version = '1';
  return merged as unknown as GlobalVibeConfig;
}

// ─── Credential helpers ─────────────────────────────────────────────

export function getGptApiKey(): string | null {
  return readGlobalConfig().credentials?.gpt?.apiKey ?? null;
}

export function getGeminiApiKey(): string | null {
  return readGlobalConfig().credentials?.gemini?.apiKey ?? null;
}

// ─── Model helpers ──────────────────────────────────────────────────

export function getModelOverride(key: string): string | undefined {
  const models = readGlobalConfig().models;
  if (!models) return undefined;
  return (models as Record<string, string | undefined>)[key];
}

// ─── Migration ──────────────────────────────────────────────────────

/** 기존 %APPDATA%/vibe 경로 (Windows) 또는 ~/.config/vibe (Linux/Mac) */
function getLegacyConfigDir(): string {
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'vibe',
    );
  }
  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
    'vibe',
  );
}

function readJsonSafe<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function parseEnvFile(envPath: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    if (!fs.existsSync(envPath)) return result;
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (!val.startsWith('"') && !val.startsWith("'")) {
        const hashIdx = val.indexOf('#');
        if (hashIdx > 0) val = val.slice(0, hashIdx).trim();
      }
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (val) result[key] = val;
    }
  } catch { /* ignore */ }
  return result;
}

function deleteFileSafe(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore */ }
}

/**
 * 레거시 파일들을 ~/.vibe/config.json 으로 마이그레이션.
 * 마이그레이션 후 기존 파일 삭제.
 */
export function migrateLegacyFiles(): void {
  const vibeDir = getVibeDir();
  const legacyDir = getLegacyConfigDir();
  const config = readGlobalConfig();

  let changed = false;

  // 1. ~/.vibe/.env → credentials, models, settings
  const envVars = parseEnvFile(path.join(vibeDir, '.env'));
  if (Object.keys(envVars).length > 0) {
    if (!config.credentials) config.credentials = {};

    // GPT credentials
    if (envVars.OPENAI_API_KEY && !config.credentials.gpt?.apiKey) {
      if (!config.credentials.gpt) config.credentials.gpt = {};
      config.credentials.gpt.apiKey = envVars.OPENAI_API_KEY;
      changed = true;
    }
    // Gemini credentials
    if (envVars.GEMINI_API_KEY && !config.credentials.gemini?.apiKey) {
      if (!config.credentials.gemini) config.credentials.gemini = {};
      config.credentials.gemini.apiKey = envVars.GEMINI_API_KEY;
      changed = true;
    }
    // Model overrides
    if (!config.models) config.models = {};
    const modelMap: Record<string, keyof NonNullable<GlobalVibeConfig['models']>> = {
      GPT_MODEL: 'gpt',
      GEMINI_MODEL: 'gemini',
      GEMINI_FLASH_MODEL: 'geminiFlash',
      GEMINI_SEARCH_MODEL: 'geminiSearch',
      CLAUDE_ARCHITECTURE_MODEL: 'claudeArchitecture',
      CLAUDE_RESEARCH_MODEL: 'claudeResearch',
      CLAUDE_REVIEW_MODEL: 'claudeReview',
      CLAUDE_BACKGROUND_MODEL: 'claudeBackground',
      EMBEDDING_MODEL: 'embedding',
      GEMINI_EMBEDDING_MODEL: 'geminiEmbedding',
    };
    for (const [envKey, modelKey] of Object.entries(modelMap)) {
      if (envVars[envKey] && !config.models[modelKey]) {
        (config.models as Record<string, string>)[modelKey] = envVars[envKey];
        changed = true;
      }
    }

    // Telegram from .env
    if (envVars.TELEGRAM_BOT_TOKEN && !config.channels?.telegram?.botToken) {
      if (!config.channels) config.channels = {};
      if (!config.channels.telegram) config.channels.telegram = {};
      config.channels.telegram.botToken = envVars.TELEGRAM_BOT_TOKEN;
      if (envVars.TELEGRAM_ALLOWED_CHAT_IDS) {
        config.channels.telegram.allowedChatIds = envVars.TELEGRAM_ALLOWED_CHAT_IDS.split(',').map((s: string) => s.trim());
      }
      changed = true;
    }

    // Slack from .env
    if (envVars.SLACK_BOT_TOKEN && !config.channels?.slack?.botToken) {
      if (!config.channels) config.channels = {};
      if (!config.channels.slack) config.channels.slack = {};
      config.channels.slack.botToken = envVars.SLACK_BOT_TOKEN;
      if (envVars.SLACK_APP_TOKEN) {
        config.channels.slack.appToken = envVars.SLACK_APP_TOKEN;
      }
      if (envVars.SLACK_ALLOWED_CHANNELS) {
        config.channels.slack.allowedChannelIds = envVars.SLACK_ALLOWED_CHANNELS.split(',').map((s: string) => s.trim());
      }
      changed = true;
    }

    // Settings
    if (envVars.WORKSPACE_DIR) {
      if (!config.settings) config.settings = {};
      if (!config.settings.workspaceDir) {
        config.settings.workspaceDir = envVars.WORKSPACE_DIR;
        changed = true;
      }
    }

    deleteFileSafe(path.join(vibeDir, '.env'));
  }

  // 2. ~/.vibe/telegram.json → channels.telegram
  const telegramConfig = readJsonSafe<{ botToken: string; allowedChatIds: string[] }>(
    path.join(vibeDir, 'telegram.json'),
  );
  if (telegramConfig?.botToken && !config.channels?.telegram) {
    if (!config.channels) config.channels = {};
    config.channels.telegram = {
      botToken: telegramConfig.botToken,
      allowedChatIds: telegramConfig.allowedChatIds || [],
    };
    changed = true;
    deleteFileSafe(path.join(vibeDir, 'telegram.json'));
  }

  // 3. ~/.vibe/slack.json → channels.slack
  const slackConfig = readJsonSafe<{ botToken: string; appToken: string; allowedChannelIds: string[] }>(
    path.join(vibeDir, 'slack.json'),
  );
  if (slackConfig?.botToken && !config.channels?.slack) {
    if (!config.channels) config.channels = {};
    config.channels.slack = {
      botToken: slackConfig.botToken,
      appToken: slackConfig.appToken,
      allowedChannelIds: slackConfig.allowedChannelIds || [],
    };
    changed = true;
    deleteFileSafe(path.join(vibeDir, 'slack.json'));
  }

  // 4. Legacy config dir (AppData/Roaming or ~/.config) → credentials
  if (legacyDir !== vibeDir) {
    // gpt-apikey.json
    const gptKey = readJsonSafe<{ apiKey: string }>(path.join(legacyDir, 'gpt-apikey.json'));
    if (gptKey?.apiKey && !config.credentials?.gpt?.apiKey) {
      if (!config.credentials) config.credentials = {};
      if (!config.credentials.gpt) config.credentials.gpt = {};
      config.credentials.gpt.apiKey = gptKey.apiKey;
      changed = true;
    }
    deleteFileSafe(path.join(legacyDir, 'gpt-apikey.json'));

    // gemini-apikey.json
    const geminiKey = readJsonSafe<{ apiKey: string }>(path.join(legacyDir, 'gemini-apikey.json'));
    if (geminiKey?.apiKey && !config.credentials?.gemini?.apiKey) {
      if (!config.credentials) config.credentials = {};
      if (!config.credentials.gemini) config.credentials.gemini = {};
      config.credentials.gemini.apiKey = geminiKey.apiKey;
      changed = true;
    }
    deleteFileSafe(path.join(legacyDir, 'gemini-apikey.json'));

    // gpt-auth.json
    deleteFileSafe(path.join(legacyDir, 'gpt-auth.json'));

    // OAuth cache 이동 (legacyDir/oauth → vibeDir/oauth)
    const legacyOauthDir = path.join(legacyDir, 'oauth');
    const newOauthDir = path.join(vibeDir, 'oauth');
    if (fs.existsSync(legacyOauthDir) && !fs.existsSync(newOauthDir)) {
      try {
        fs.cpSync(legacyOauthDir, newOauthDir, { recursive: true });
        fs.rmSync(legacyOauthDir, { recursive: true, force: true });
        changed = true;
      } catch { /* ignore */ }
    }
  }

  // 5. ~/.vibe/ 내 직접 존재하는 레거시 파일도 처리
  const gptKeyInVibe = readJsonSafe<{ apiKey: string }>(path.join(vibeDir, 'gpt-apikey.json'));
  if (gptKeyInVibe?.apiKey && !config.credentials?.gpt?.apiKey) {
    if (!config.credentials) config.credentials = {};
    if (!config.credentials.gpt) config.credentials.gpt = {};
    config.credentials.gpt.apiKey = gptKeyInVibe.apiKey;
    changed = true;
  }
  deleteFileSafe(path.join(vibeDir, 'gpt-apikey.json'));

  const geminiKeyInVibe = readJsonSafe<{ apiKey: string }>(path.join(vibeDir, 'gemini-apikey.json'));
  if (geminiKeyInVibe?.apiKey && !config.credentials?.gemini?.apiKey) {
    if (!config.credentials) config.credentials = {};
    if (!config.credentials.gemini) config.credentials.gemini = {};
    config.credentials.gemini.apiKey = geminiKeyInVibe.apiKey;
    changed = true;
  }
  deleteFileSafe(path.join(vibeDir, 'gemini-apikey.json'));
  deleteFileSafe(path.join(vibeDir, 'gpt-auth.json'));

  if (changed) {
    writeGlobalConfig(config);
  }
}
