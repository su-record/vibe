/**
 * CLI Commands: vibe slack <subcommand>
 * Phase 4: External Interface
 *
 * Stores Slack credentials in ~/.vibe/slack.json
 * Similar pattern to vibe telegram setup.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const SLACK_CONFIG_FILE = path.join(VIBE_DIR, 'slack.json');

interface SlackCliConfig {
  botToken: string;
  appToken: string;
  allowedChannelIds: string[];
}

function loadConfig(): SlackCliConfig | null {
  try {
    if (!fs.existsSync(SLACK_CONFIG_FILE)) return null;
    return JSON.parse(fs.readFileSync(SLACK_CONFIG_FILE, 'utf-8')) as SlackCliConfig;
  } catch {
    return null;
  }
}

function saveConfig(config: SlackCliConfig): void {
  if (!fs.existsSync(VIBE_DIR)) {
    fs.mkdirSync(VIBE_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(SLACK_CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function slackSetup(botToken?: string, appToken?: string): void {
  if (!botToken || !appToken) {
    console.log('Usage: vibe slack setup <bot-token> <app-token>');
    console.log('  bot-token: Slack Bot Token (xoxb-...)');
    console.log('  app-token: Slack App-Level Token (xapp-...)');
    return;
  }

  const existing = loadConfig();
  const config: SlackCliConfig = {
    botToken,
    appToken,
    allowedChannelIds: existing?.allowedChannelIds || [],
  };

  saveConfig(config);
  console.log('Slack tokens saved');
  if (config.allowedChannelIds.length === 0) {
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

  if (config.allowedChannelIds.includes(channelId)) {
    console.log(`Channel ID "${channelId}" is already in the allow list`);
    return;
  }

  config.allowedChannelIds.push(channelId);
  saveConfig(config);
  console.log(`Channel ID "${channelId}" added to allow list`);
}

export function slackStatus(): void {
  const config = loadConfig();
  if (!config) {
    console.log('Slack: not configured');
    return;
  }

  const botPreview = config.botToken.slice(0, 8) + '...' + config.botToken.slice(-4);
  const appPreview = config.appToken.slice(0, 8) + '...' + config.appToken.slice(-4);
  console.log(`Slack Bot Token: configured (${botPreview})`);
  console.log(`Slack App Token: configured (${appPreview})`);
  console.log(`Allowed channels: ${config.allowedChannelIds.length > 0 ? config.allowedChannelIds.join(', ') : 'none'}`);
}

export function slackHelp(): void {
  console.log(`
Vibe Slack Commands:
  vibe slack setup <bot-token> <app-token>   Set Slack tokens
  vibe slack channel <id>                    Add allowed channel ID
  vibe slack status                          Show configuration
  vibe slack help                            Show this help

Get tokens from https://api.slack.com/apps
  Bot Token: OAuth & Permissions → Bot User OAuth Token (xoxb-)
  App Token: Basic Information → App-Level Tokens (xapp-)
  `);
}
