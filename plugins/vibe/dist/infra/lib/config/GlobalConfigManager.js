/**
 * GlobalConfigManager — ~/.vibe/config.json 통합 관리
 *
 * 모든 설정(credentials, channels, models, settings)을 하나의 파일로 관리.
 * 플랫폼 무관 ~/.vibe/ 디렉토리 사용.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
// ─── Constants ──────────────────────────────────────────────────────
const VIBE_DIR_NAME = '.vibe';
const CONFIG_FILE_NAME = 'config.json';
const FILE_PERMISSIONS = 0o600;
const DIR_PERMISSIONS = 0o700;
// ─── In-memory cache ────────────────────────────────────────────────
let cachedConfig = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5_000;
function invalidateCache() {
    cachedConfig = null;
    cacheTimestamp = 0;
}
// ─── Path helpers ───────────────────────────────────────────────────
/** ~/.vibe/ (플랫폼 무관 통일) */
export function getVibeDir() {
    return path.join(os.homedir(), VIBE_DIR_NAME);
}
/** ~/.vibe/config.json */
export function getGlobalConfigPath() {
    return path.join(getVibeDir(), CONFIG_FILE_NAME);
}
// ─── Read / Write ───────────────────────────────────────────────────
function createDefaultConfig() {
    return { version: '1' };
}
export function readGlobalConfig() {
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
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object') {
            return createDefaultConfig();
        }
        const config = parsed;
        if (!config.version) {
            config.version = '1';
        }
        cachedConfig = config;
        cacheTimestamp = now;
        return config;
    }
    catch {
        return createDefaultConfig();
    }
}
export function writeGlobalConfig(config) {
    const vibeDir = getVibeDir();
    if (!fs.existsSync(vibeDir)) {
        fs.mkdirSync(vibeDir, { recursive: true, mode: DIR_PERMISSIONS });
    }
    const configPath = getGlobalConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: FILE_PERMISSIONS });
    invalidateCache();
}
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const srcVal = source[key];
        if (srcVal === undefined)
            continue;
        const tgtVal = target[key];
        if (tgtVal && typeof tgtVal === 'object' && !Array.isArray(tgtVal) &&
            srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
            result[key] = deepMerge(tgtVal, srcVal);
        }
        else {
            result[key] = srcVal;
        }
    }
    return result;
}
export function patchGlobalConfig(patch) {
    const current = readGlobalConfig();
    const merged = deepMerge(current, patch);
    merged.version = '1';
    writeGlobalConfig(merged);
}
// ─── Project config + layered merge ────────────────────────────────
/** .vibe/config.json (프로젝트별 설정 SSOT) */
export function getProjectConfigPath(projectDir) {
    return path.join(projectDir, '.vibe', 'config.json');
}
/** legacy .claude/vibe/config.json (읽기 fallback 전용) */
export function getLegacyProjectConfigPath(projectDir) {
    return path.join(projectDir, '.claude', 'vibe', 'config.json');
}
export function getProjectConfigPaths(projectDir) {
    return [
        getProjectConfigPath(projectDir),
        getLegacyProjectConfigPath(projectDir),
    ];
}
function readProjectConfig(projectDir) {
    for (const configPath of getProjectConfigPaths(projectDir)) {
        try {
            if (!fs.existsSync(configPath))
                continue;
            const content = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(content);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                continue;
            return parsed;
        }
        catch {
            return {};
        }
    }
    return {};
}
/**
 * 다중 계층 설정 병합: 글로벌(~/.vibe) + 프로젝트(.vibe)
 * 우선순위: 프로젝트 > 글로벌 (프로젝트 설정이 글로벌을 덮어씀)
 * credentials는 글로벌 전용 — 프로젝트에서 덮어쓰지 않음.
 */
export function resolveConfig(projectDir) {
    const global = readGlobalConfig();
    const project = readProjectConfig(projectDir);
    if (Object.keys(project).length === 0) {
        return global;
    }
    // credentials는 글로벌 전용이므로 프로젝트에서 제거 후 병합
    const { credentials: _ignored, ...projectWithoutCreds } = project;
    const merged = deepMerge(global, projectWithoutCreds);
    merged.version = '1';
    return merged;
}
// ─── Credential helpers ─────────────────────────────────────────────
export function getGptApiKey() {
    return readGlobalConfig().credentials?.gpt?.apiKey ?? null;
}
export function getAntigravityApiKey() {
    return readGlobalConfig().credentials?.antigravity?.apiKey ?? null;
}
export function getZaiApiKey() {
    return readGlobalConfig().credentials?.zai?.apiKey ?? null;
}
export function getZaiCodingApiKey() {
    return readGlobalConfig().credentials?.zai?.codingApiKey ?? null;
}
// ─── Model helpers ──────────────────────────────────────────────────
export function getModelOverride(key) {
    const models = readGlobalConfig().models;
    if (!models)
        return undefined;
    return models[key];
}
// ─── Migration ──────────────────────────────────────────────────────
/** 기존 %APPDATA%/vibe 경로 (Windows) 또는 ~/.config/vibe (Linux/Mac) */
function getLegacyConfigDir() {
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe');
    }
    return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'vibe');
}
function readJsonSafe(filePath) {
    try {
        if (!fs.existsSync(filePath))
            return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    catch {
        return null;
    }
}
function parseEnvFile(envPath) {
    const result = {};
    try {
        if (!fs.existsSync(envPath))
            return result;
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx < 0)
                continue;
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if (!val.startsWith('"') && !val.startsWith("'")) {
                const hashIdx = val.indexOf('#');
                if (hashIdx > 0)
                    val = val.slice(0, hashIdx).trim();
            }
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (val)
                result[key] = val;
        }
    }
    catch { /* ignore */ }
    return result;
}
function deleteFileSafe(filePath) {
    try {
        if (fs.existsSync(filePath))
            fs.unlinkSync(filePath);
    }
    catch { /* ignore */ }
}
/**
 * 레거시 파일들을 ~/.vibe/config.json 으로 마이그레이션.
 * 마이그레이션 후 기존 파일 삭제.
 */
export function migrateLegacyFiles() {
    const vibeDir = getVibeDir();
    const legacyDir = getLegacyConfigDir();
    const config = readGlobalConfig();
    let changed = false;
    // 1. ~/.vibe/.env → credentials, models, settings
    const envVars = parseEnvFile(path.join(vibeDir, '.env'));
    if (Object.keys(envVars).length > 0) {
        if (!config.credentials)
            config.credentials = {};
        // GPT credentials
        if (envVars.OPENAI_API_KEY && !config.credentials.gpt?.apiKey) {
            if (!config.credentials.gpt)
                config.credentials.gpt = {};
            config.credentials.gpt.apiKey = envVars.OPENAI_API_KEY;
            changed = true;
        }
        // Antigravity credentials
        if (envVars.ANTIGRAVITY_API_KEY && !config.credentials.antigravity?.apiKey) {
            if (!config.credentials.antigravity)
                config.credentials.antigravity = {};
            config.credentials.antigravity.apiKey = envVars.ANTIGRAVITY_API_KEY;
            changed = true;
        }
        // Model overrides
        if (!config.models)
            config.models = {};
        const modelMap = {
            GPT_MODEL: 'gpt',
            ANTIGRAVITY_MODEL: 'antigravity',
            CLAUDE_ARCHITECTURE_MODEL: 'claudeArchitecture',
            CLAUDE_RESEARCH_MODEL: 'claudeResearch',
            CLAUDE_REVIEW_MODEL: 'claudeReview',
            CLAUDE_BACKGROUND_MODEL: 'claudeBackground',
            EMBEDDING_MODEL: 'embedding',
            ANTIGRAVITY_EMBEDDING_MODEL: 'antigravityEmbedding',
        };
        for (const [envKey, modelKey] of Object.entries(modelMap)) {
            if (envVars[envKey] && !config.models[modelKey]) {
                config.models[modelKey] = envVars[envKey];
                changed = true;
            }
        }
        // Telegram from .env
        if (envVars.TELEGRAM_BOT_TOKEN && !config.channels?.telegram?.botToken) {
            if (!config.channels)
                config.channels = {};
            if (!config.channels.telegram)
                config.channels.telegram = {};
            config.channels.telegram.botToken = envVars.TELEGRAM_BOT_TOKEN;
            if (envVars.TELEGRAM_ALLOWED_CHAT_IDS) {
                config.channels.telegram.allowedChatIds = envVars.TELEGRAM_ALLOWED_CHAT_IDS.split(',').map((s) => s.trim());
            }
            changed = true;
        }
        // Slack from .env
        if (envVars.SLACK_BOT_TOKEN && !config.channels?.slack?.botToken) {
            if (!config.channels)
                config.channels = {};
            if (!config.channels.slack)
                config.channels.slack = {};
            config.channels.slack.botToken = envVars.SLACK_BOT_TOKEN;
            if (envVars.SLACK_APP_TOKEN) {
                config.channels.slack.appToken = envVars.SLACK_APP_TOKEN;
            }
            if (envVars.SLACK_ALLOWED_CHANNELS) {
                config.channels.slack.allowedChannelIds = envVars.SLACK_ALLOWED_CHANNELS.split(',').map((s) => s.trim());
            }
            changed = true;
        }
        // Settings
        if (envVars.WORKSPACE_DIR) {
            if (!config.settings)
                config.settings = {};
            if (!config.settings.workspaceDir) {
                config.settings.workspaceDir = envVars.WORKSPACE_DIR;
                changed = true;
            }
        }
        deleteFileSafe(path.join(vibeDir, '.env'));
    }
    // 2. ~/.vibe/telegram.json → channels.telegram
    const telegramConfig = readJsonSafe(path.join(vibeDir, 'telegram.json'));
    if (telegramConfig?.botToken && !config.channels?.telegram) {
        if (!config.channels)
            config.channels = {};
        config.channels.telegram = {
            botToken: telegramConfig.botToken,
            allowedChatIds: telegramConfig.allowedChatIds || [],
        };
        changed = true;
        deleteFileSafe(path.join(vibeDir, 'telegram.json'));
    }
    // 3. ~/.vibe/slack.json → channels.slack
    const slackConfig = readJsonSafe(path.join(vibeDir, 'slack.json'));
    if (slackConfig?.botToken && !config.channels?.slack) {
        if (!config.channels)
            config.channels = {};
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
        const gptKey = readJsonSafe(path.join(legacyDir, 'gpt-apikey.json'));
        if (gptKey?.apiKey && !config.credentials?.gpt?.apiKey) {
            if (!config.credentials)
                config.credentials = {};
            if (!config.credentials.gpt)
                config.credentials.gpt = {};
            config.credentials.gpt.apiKey = gptKey.apiKey;
            changed = true;
        }
        deleteFileSafe(path.join(legacyDir, 'gpt-apikey.json'));
        // antigravity-apikey.json
        const antigravityKey = readJsonSafe(path.join(legacyDir, 'antigravity-apikey.json'));
        if (antigravityKey?.apiKey && !config.credentials?.antigravity?.apiKey) {
            if (!config.credentials)
                config.credentials = {};
            if (!config.credentials.antigravity)
                config.credentials.antigravity = {};
            config.credentials.antigravity.apiKey = antigravityKey.apiKey;
            changed = true;
        }
        deleteFileSafe(path.join(legacyDir, 'antigravity-apikey.json'));
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
            }
            catch { /* ignore */ }
        }
    }
    // 5. ~/.vibe/ 내 직접 존재하는 레거시 파일도 처리
    const gptKeyInVibe = readJsonSafe(path.join(vibeDir, 'gpt-apikey.json'));
    if (gptKeyInVibe?.apiKey && !config.credentials?.gpt?.apiKey) {
        if (!config.credentials)
            config.credentials = {};
        if (!config.credentials.gpt)
            config.credentials.gpt = {};
        config.credentials.gpt.apiKey = gptKeyInVibe.apiKey;
        changed = true;
    }
    deleteFileSafe(path.join(vibeDir, 'gpt-apikey.json'));
    const antigravityKeyInVibe = readJsonSafe(path.join(vibeDir, 'antigravity-apikey.json'));
    if (antigravityKeyInVibe?.apiKey && !config.credentials?.antigravity?.apiKey) {
        if (!config.credentials)
            config.credentials = {};
        if (!config.credentials.antigravity)
            config.credentials.antigravity = {};
        config.credentials.antigravity.apiKey = antigravityKeyInVibe.apiKey;
        changed = true;
    }
    deleteFileSafe(path.join(vibeDir, 'antigravity-apikey.json'));
    deleteFileSafe(path.join(vibeDir, 'gpt-auth.json'));
    if (changed) {
        writeGlobalConfig(config);
    }
}
//# sourceMappingURL=GlobalConfigManager.js.map