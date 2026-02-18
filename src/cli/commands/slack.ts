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

function loadConfig(): SlackChannelConfig | null {
  return readGlobalConfig().channels?.slack ?? null;
}

function saveConfig(config: SlackChannelConfig): void {
  patchGlobalConfig({ channels: { slack: config } });
}

export function slackSetup(botToken?: string, appToken?: string): void {
  if (!botToken || !appToken) {
    console.log('Usage: vibe slack setup <bot-token> <app-token>');
    console.log('  bot-token: Slack Bot Token (xoxb-...)');
    console.log('  app-token: Slack App-Level Token (xapp-...)');
    return;
  }

  const existing = loadConfig();
  const config: SlackChannelConfig = {
    botToken,
    appToken,
    allowedChannelIds: existing?.allowedChannelIds || [],
  };

  saveConfig(config);
  console.log('Slack tokens saved');
  if ((config.allowedChannelIds ?? []).length === 0) {
    console.log('No allowed channels set. Use: vibe slack channel <channel-id>');
  }
}

export function slackChannel(channelId?: string): void {
  if (!channelId) {
    console.log('Usage: vibe slack channel <channel-id>');
    console.log('  Add a Slack channel ID to the allow list');
    return;
  }

  const config = loadConfig();
  if (!config) {
    console.log('Slack not configured. Run: vibe slack setup <bot-token> <app-token>');
    return;
  }

  const channelIds = config.allowedChannelIds ?? [];
  if (channelIds.includes(channelId)) {
    console.log(`Channel ID "${channelId}" is already in the allow list`);
    return;
  }

  channelIds.push(channelId);
  config.allowedChannelIds = channelIds;
  saveConfig(config);
  console.log(`Channel ID "${channelId}" added to allow list`);
}

export function slackStatus(): void {
  const config = loadConfig();
  if (!config) {
    console.log('Slack: not configured');
    return;
  }

  const bot = config.botToken ?? '';
  const app = config.appToken ?? '';
  const botPreview = bot.slice(0, 8) + '...' + bot.slice(-4);
  const appPreview = app.slice(0, 8) + '...' + app.slice(-4);
  console.log(`Slack Bot Token: configured (${botPreview})`);
  console.log(`Slack App Token: configured (${appPreview})`);
  const channelIds = config.allowedChannelIds ?? [];
  console.log(`Allowed channels: ${channelIds.length > 0 ? channelIds.join(', ') : 'none'}`);
}

export function slackHelp(): void {
  console.log(`
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
