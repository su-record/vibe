/**
 * vibe config — Display merged configuration from all sources
 *
 * Sources (priority order):
 *   1. Environment variables (highest)
 *   2. Project config (.vibe/config.json)
 *   3. Global config (~/.vibe/config.json)
 */
import fs from 'fs';
import chalk from 'chalk';
import { readGlobalConfig, getGlobalConfigPath, getProjectConfigPath, getProjectConfigPaths, } from '../../infra/lib/config/GlobalConfigManager.js';
// ============================================================================
// Constants
// ============================================================================
const SENSITIVE_PATTERNS = [
    'apikey', 'apiKey', 'token', 'bottoken', 'botToken',
    'apptoken', 'appToken', 'accesstoken', 'accessToken', 'secret',
];
const ENV_KEY_MAP = {
    'credentials.gpt.apiKey': 'OPENAI_API_KEY',
    'credentials.antigravity.apiKey': 'ANTIGRAVITY_API_KEY',
    'credentials.figma.accessToken': 'FIGMA_ACCESS_TOKEN',
    'channels.telegram.botToken': 'TELEGRAM_BOT_TOKEN',
    'channels.slack.botToken': 'SLACK_BOT_TOKEN',
    'channels.slack.appToken': 'SLACK_APP_TOKEN',
    'models.gpt': 'GPT_MODEL',
    'models.antigravity': 'ANTIGRAVITY_MODEL',
    'models.claudeBackground': 'CLAUDE_BACKGROUND_MODEL',
    'models.claudeResearch': 'CLAUDE_RESEARCH_MODEL',
    'models.claudeReview': 'CLAUDE_REVIEW_MODEL',
    'models.claudeArchitecture': 'CLAUDE_ARCHITECTURE_MODEL',
    'models.embedding': 'EMBEDDING_MODEL',
    'models.antigravityEmbedding': 'ANTIGRAVITY_EMBEDDING_MODEL',
    'settings.workspaceDir': 'WORKSPACE_DIR',
};
// ============================================================================
// Masking
// ============================================================================
function isSensitiveKey(key) {
    const lower = key.toLowerCase();
    return SENSITIVE_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}
function maskValue(key, value) {
    if (!isSensitiveKey(key))
        return value;
    if (value.length <= 8)
        return '****';
    return `${value.slice(0, 4)}...****`;
}
// ============================================================================
// Flatten helpers
// ============================================================================
function flattenObject(obj, prefix) {
    const entries = [];
    for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
            entries.push(...flattenObject(v, fullKey));
        }
        else if (v !== undefined && v !== null) {
            const display = Array.isArray(v) ? v.join(', ') : String(v);
            entries.push({ key: fullKey, value: display });
        }
    }
    return entries;
}
// ============================================================================
// Source resolution
// ============================================================================
function readProjectConfigSafe(projectDir) {
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
function resolveEnvOverride(configKey) {
    const envKey = ENV_KEY_MAP[configKey];
    if (!envKey)
        return undefined;
    return process.env[envKey] || undefined;
}
function resolveSource(key, globalFlat, projectFlat) {
    const envVal = resolveEnvOverride(key);
    if (envVal)
        return 'env';
    if (projectFlat.has(key))
        return 'project';
    return 'global';
}
// ============================================================================
// Build merged entry list
// ============================================================================
function buildConfigEntries(projectDir) {
    const globalConfig = readGlobalConfig();
    const projectConfig = readProjectConfigSafe(projectDir);
    const globalFlat = new Map(flattenObject(globalConfig, '').map(e => [e.key, e.value]));
    const projectFlat = new Map(flattenObject(projectConfig, '').map(e => [e.key, e.value]));
    // Merge: start with global, overlay project (skip credentials from project)
    const merged = new Map(globalFlat);
    for (const [k, v] of projectFlat) {
        if (!k.startsWith('credentials.')) {
            merged.set(k, v);
        }
    }
    // Overlay env overrides
    for (const configKey of Object.keys(ENV_KEY_MAP)) {
        const envVal = resolveEnvOverride(configKey);
        if (envVal)
            merged.set(configKey, envVal);
    }
    const entries = [];
    for (const [key, value] of merged) {
        const source = resolveSource(key, globalFlat, projectFlat);
        entries.push({ key, value, source });
    }
    return entries.sort((a, b) => a.key.localeCompare(b.key));
}
// ============================================================================
// Formatting
// ============================================================================
const SOURCE_LABELS = {
    global: chalk.blue('[global]'),
    project: chalk.green('[project]'),
    env: chalk.yellow('[env]'),
};
function formatEntry(entry) {
    const label = SOURCE_LABELS[entry.source];
    const masked = maskValue(entry.key, entry.value);
    return `  ${chalk.white(entry.key)} = ${chalk.gray(masked)}  ${label}`;
}
function printSourceLegend() {
    console.log(chalk.dim('Sources:'));
    console.log(chalk.dim(`  ${chalk.blue('[global]')}  ~/.vibe/config.json`));
    console.log(chalk.dim(`  ${chalk.green('[project]')} .vibe/config.json`));
    console.log(chalk.dim(`  ${chalk.yellow('[env]')}     Environment variable`));
    console.log('');
}
// ============================================================================
// Public API
// ============================================================================
/**
 * Display merged configuration from all sources
 */
export function configShow() {
    const projectDir = process.cwd();
    const globalPath = getGlobalConfigPath();
    const projectPath = getProjectConfigPath(projectDir);
    const projectPaths = getProjectConfigPaths(projectDir);
    const globalExists = fs.existsSync(globalPath);
    const projectExists = projectPaths.some(p => fs.existsSync(p));
    console.log('');
    console.log(chalk.bold('Vibe Configuration (merged)'));
    console.log('');
    printSourceLegend();
    // File status
    console.log(chalk.dim('Files:'));
    console.log(`  ${globalExists ? chalk.green('found') : chalk.red('missing')}  ${globalPath}`);
    console.log(`  ${projectExists ? chalk.green('found') : chalk.red('missing')}  ${projectPath}`);
    console.log('');
    const entries = buildConfigEntries(projectDir);
    if (entries.length === 0) {
        console.log(chalk.dim('  No configuration found. Run: vibe setup'));
        console.log('');
        return;
    }
    // Group by top-level section
    const sections = new Map();
    for (const entry of entries) {
        const section = entry.key.split('.')[0];
        const list = sections.get(section) ?? [];
        list.push(entry);
        sections.set(section, list);
    }
    for (const [section, sectionEntries] of sections) {
        console.log(chalk.bold.underline(section));
        for (const entry of sectionEntries) {
            console.log(formatEntry(entry));
        }
        console.log('');
    }
}
/**
 * Display config subcommand help
 */
export function configHelp() {
    console.log(`
Config Commands:
  vibe config show          Show merged configuration from all sources
  vibe config help          Show this help

Sources (priority high → low):
  1. Environment variables
  2. Project config (.vibe/config.json)
  3. Global config  (~/.vibe/config.json)
  `);
}
//# sourceMappingURL=config.js.map