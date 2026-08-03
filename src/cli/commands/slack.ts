/**
 * CLI Commands: vibe slack <subcommand>
 * Phase 4: External Interface
 *
 * 설정은 ~/.vibe/config.json channels.slack에 통합 저장
 */

import {
  readGlobalConfig,
  patchGlobalConfig,
} from '../../infra/lib/config/GlobalConfigManager.js';
import type { SlackChannelConfig } from '../types.js';

import { log } from '../utils.js';
function loadConfig(): SlackChannelConfig | null {
  return readGlobalConfig().channels?.slack ?? null;
}

function saveConfig(config: SlackChannelConfig): void {
  patchGlobalConfig({ channels: { slack: config } });
}

export function slackSetup(botToken?: string, appToken?: string): void {
  if (!botToken || !appToken) {
    log('Usage: vibe slack setup <bot-token> <app-token>');
    log('  bot-token: Slack Bot Token (xoxb-...)');
    log('  app-token: Slack App-Level Token (xapp-...)');
    return;
  }

  const existing = loadConfig();
  const config: SlackChannelConfig = {
    botToken,
    appToken,
    allowedChannelIds: existing?.allowedChannelIds || [],
  };

  saveConfig(config);
  log('Slack tokens saved');
  if ((config.allowedChannelIds ?? []).length === 0) {
    log('No allowed channels set. Use: vibe slack channel <channel-id>');
  }
}

export function slackChannel(channelId?: string): void {
  if (!channelId) {
    log('Usage: vibe slack channel <channel-id>');
    log('  Add a Slack channel ID to the allow list');
    return;
  }

  const config = loadConfig();
  if (!config) {
    log('Slack not configured. Run: vibe slack setup <bot-token> <app-token>');
    return;
  }

  const channelIds = config.allowedChannelIds ?? [];
  if (channelIds.includes(channelId)) {
    log(`Channel ID "${channelId}" is already in the allow list`);
    return;
  }

  channelIds.push(channelId);
  config.allowedChannelIds = channelIds;
  saveConfig(config);
  log(`Channel ID "${channelId}" added to allow list`);
}

export function slackStatus(): void {
  const config = loadConfig();
  if (!config) {
    log('Slack: not configured');
    return;
  }

  const bot = config.botToken ?? '';
  const app = config.appToken ?? '';
  const botPreview = bot.slice(0, 8) + '...' + bot.slice(-4);
  const appPreview = app.slice(0, 8) + '...' + app.slice(-4);
  log(`Slack Bot Token: configured (${botPreview})`);
  log(`Slack App Token: configured (${appPreview})`);
  const channelIds = config.allowedChannelIds ?? [];
  log(`Allowed channels: ${channelIds.length > 0 ? channelIds.join(', ') : 'none'}`);
}

export function slackHelp(): void {
  log(`
Vibe Slack Commands:
  vibe slack setup <bot-token> <app-token>   Set Slack tokens
  vibe slack channel <id>                    Add allowed channel ID
  vibe slack status                          Show configuration
  vibe slack help                            Show this help

Get tokens from https://api.slack.com/apps
  Bot Token: OAuth & Permissions > Bot User OAuth Token (xoxb-)
  App Token: Basic Information > App-Level Tokens (xapp-)
  `);
}
