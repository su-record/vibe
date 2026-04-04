/**
 * vibe config — Display merged configuration from all sources
 *
 * Sources (priority order):
 *   1. Environment variables (highest)
 *   2. Project config (.claude/vibe/config.json)
 *   3. Global config (~/.vibe/config.json)
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import {
  readGlobalConfig,
  getGlobalConfigPath,
  getProjectConfigPath,
} from '../../infra/lib/config/GlobalConfigManager.js';
import type { GlobalVibeConfig, VibeConfig } from '../types.js';

// ============================================================================
// Constants
// ============================================================================

const SENSITIVE_PATTERNS = [
  'apikey', 'apiKey', 'token', 'bottoken', 'botToken',
  'apptoken', 'appToken', 'accesstoken', 'accessToken', 'secret',
];

const ENV_KEY_MAP: Record<string, string> = {
  'credentials.gpt.apiKey': 'OPENAI_API_KEY',
  'credentials.gemini.apiKey': 'GEMINI_API_KEY',
  'credentials.figma.accessToken': 'FIGMA_ACCESS_TOKEN',
  'channels.telegram.botToken': 'TELEGRAM_BOT_TOKEN',
  'channels.slack.botToken': 'SLACK_BOT_TOKEN',
  'channels.slack.appToken': 'SLACK_APP_TOKEN',
  'models.gpt': 'GPT_MODEL',
  'models.gemini': 'GEMINI_MODEL',
  'models.geminiFlash': 'GEMINI_FLASH_MODEL',
  'models.geminiSearch': 'GEMINI_SEARCH_MODEL',
  'models.claudeBackground': 'CLAUDE_BACKGROUND_MODEL',
  'models.claudeResearch': 'CLAUDE_RESEARCH_MODEL',
  'models.claudeReview': 'CLAUDE_REVIEW_MODEL',
  'models.claudeArchitecture': 'CLAUDE_ARCHITECTURE_MODEL',
  'models.embedding': 'EMBEDDING_MODEL',
  'models.geminiEmbedding': 'GEMINI_EMBEDDING_MODEL',
  'settings.workspaceDir': 'WORKSPACE_DIR',
};

type ConfigSource = 'global' | 'project' | 'env';

interface ConfigEntry {
  key: string;
  value: string;
  source: ConfigSource;
}

// ============================================================================
// Masking
// ============================================================================

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

function maskValue(key: string, value: string): string {
  if (!isSensitiveKey(key)) return value;
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}...****`;
}

// ============================================================================
// Flatten helpers
// ============================================================================

function flattenObject(
  obj: Record<string, unknown>,
  prefix: string,
): Array<{ key: string; value: string }> {
  const entries: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
      entries.push(...flattenObject(v as Record<string, unknown>, fullKey));
    } else if (v !== undefined && v !== null) {
      const display = Array.isArray(v) ? v.join(', ') : String(v);
      entries.push({ key: fullKey, value: display });
    }
  }
  return entries;
}

// ============================================================================
// Source resolution
// ============================================================================

function readProjectConfigSafe(projectDir: string): Record<string, unknown> {
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

function resolveEnvOverride(configKey: string): string | undefined {
  const envKey = ENV_KEY_MAP[configKey];
  if (!envKey) return undefined;
  return process.env[envKey] || undefined;
}

function resolveSource(
  key: string,
  globalFlat: Map<string, string>,
  projectFlat: Map<string, string>,
): ConfigSource {
  const envVal = resolveEnvOverride(key);
  if (envVal) return 'env';
  if (projectFlat.has(key)) return 'project';
  return 'global';
}

// ============================================================================
// Build merged entry list
// ============================================================================

function buildConfigEntries(projectDir: string): ConfigEntry[] {
  const globalConfig = readGlobalConfig();
  const projectConfig = readProjectConfigSafe(projectDir);

  const globalFlat = new Map(
    flattenObject(globalConfig as unknown as Record<string, unknown>, '').map(
      e => [e.key, e.value] as [string, string],
    ),
  );
  const projectFlat = new Map(
    flattenObject(projectConfig, '').map(
      e => [e.key, e.value] as [string, string],
    ),
  );

  // Merge: start with global, overlay project (skip credentials from project)
  const merged = new Map<string, string>(globalFlat);
  for (const [k, v] of projectFlat) {
    if (!k.startsWith('credentials.')) {
      merged.set(k, v);
    }
  }

  // Overlay env overrides
  for (const configKey of Object.keys(ENV_KEY_MAP)) {
    const envVal = resolveEnvOverride(configKey);
    if (envVal) merged.set(configKey, envVal);
  }

  const entries: ConfigEntry[] = [];
  for (const [key, value] of merged) {
    const source = resolveSource(key, globalFlat, projectFlat);
    entries.push({ key, value, source });
  }

  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

// ============================================================================
// Formatting
// ============================================================================

const SOURCE_LABELS: Record<ConfigSource, string> = {
  global: chalk.blue('[global]'),
  project: chalk.green('[project]'),
  env: chalk.yellow('[env]'),
};

function formatEntry(entry: ConfigEntry): string {
  const label = SOURCE_LABELS[entry.source];
  const masked = maskValue(entry.key, entry.value);
  return `  ${chalk.white(entry.key)} = ${chalk.gray(masked)}  ${label}`;
}

function printSourceLegend(): void {
  console.log(chalk.dim('Sources:'));
  console.log(chalk.dim(`  ${chalk.blue('[global]')}  ~/.vibe/config.json`));
  console.log(chalk.dim(`  ${chalk.green('[project]')} .claude/vibe/config.json`));
  console.log(chalk.dim(`  ${chalk.yellow('[env]')}     Environment variable`));
  console.log('');
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Display merged configuration from all sources
 */
export function configShow(): void {
  const projectDir = process.cwd();
  const globalPath = getGlobalConfigPath();
  const projectPath = getProjectConfigPath(projectDir);

  const globalExists = fs.existsSync(globalPath);
  const projectExists = fs.existsSync(projectPath);

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
  const sections = new Map<string, ConfigEntry[]>();
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
export function configHelp(): void {
  console.log(`
Config Commands:
  vibe config show          Show merged configuration from all sources
  vibe config help          Show this help

Sources (priority high → low):
  1. Environment variables
  2. Project config (.claude/vibe/config.json)
  3. Global config  (~/.vibe/config.json)
  `);
}
