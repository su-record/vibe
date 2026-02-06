/**
 * CLI Commands: vibe webhook <subcommand>
 * Phase 4: External Interface
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { WebhookProvider } from '../../interface/types.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const WEBHOOK_CONFIG = path.join(VIBE_DIR, 'webhooks.json');

interface WebhookEntry {
  name: string;
  provider: WebhookProvider;
  secret: string;
  createdAt: string;
}

function loadWebhooks(): WebhookEntry[] {
  try {
    if (!fs.existsSync(WEBHOOK_CONFIG)) return [];
    return JSON.parse(fs.readFileSync(WEBHOOK_CONFIG, 'utf-8')) as WebhookEntry[];
  } catch {
    return [];
  }
}

function saveWebhooks(webhooks: WebhookEntry[]): void {
  if (!fs.existsSync(VIBE_DIR)) {
    fs.mkdirSync(VIBE_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(WEBHOOK_CONFIG, JSON.stringify(webhooks, null, 2), { mode: 0o600 });
}

export function webhookAdd(name: string, secret: string, provider?: string): void {
  if (!name || !secret) {
    console.log('Usage: vibe webhook add <name> <secret> [provider]');
    console.log('  provider: github (default), gitlab, custom');
    return;
  }

  const webhookProvider = (provider || 'github') as WebhookProvider;
  const webhooks = loadWebhooks();

  const existing = webhooks.findIndex((w) => w.name === name);
  if (existing >= 0) {
    webhooks[existing] = { name, provider: webhookProvider, secret, createdAt: new Date().toISOString() };
    console.log(`Webhook "${name}" updated`);
  } else {
    webhooks.push({ name, provider: webhookProvider, secret, createdAt: new Date().toISOString() });
    console.log(`Webhook "${name}" added (${webhookProvider})`);
  }

  saveWebhooks(webhooks);
}

export function webhookList(): void {
  const webhooks = loadWebhooks();

  if (webhooks.length === 0) {
    console.log('No webhooks configured');
    return;
  }

  console.log(`
Webhooks (${webhooks.length}):
${'━'.repeat(50)}`);

  for (const w of webhooks) {
    const secretPreview = w.secret.slice(0, 4) + '...' + w.secret.slice(-4);
    console.log(`  ${w.name.padEnd(20)} ${w.provider.padEnd(10)} ${secretPreview}`);
  }

  console.log('━'.repeat(50));
}

export function webhookRemove(name: string): void {
  if (!name) {
    console.log('Usage: vibe webhook remove <name>');
    return;
  }

  const webhooks = loadWebhooks();
  const filtered = webhooks.filter((w) => w.name !== name);

  if (filtered.length === webhooks.length) {
    console.log(`Webhook "${name}" not found`);
    return;
  }

  saveWebhooks(filtered);
  console.log(`Webhook "${name}" removed`);
}

export function webhookHelp(): void {
  console.log(`
Vibe Webhook Commands:
  vibe webhook add <name> <secret> [provider]  Add webhook
  vibe webhook list                             List webhooks
  vibe webhook remove <name>                    Remove webhook
  vibe webhook help                             Show this help

Providers: github (default), gitlab, custom
  `);
}
