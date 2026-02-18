/**
 * CLI Commands: vibe telegram <subcommand>
 * Phase 4: External Interface
 *
 * 설정은 ~/.vibe/config.json channels.telegram에 통합 저장
 */

import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import {
  readGlobalConfig,
  patchGlobalConfig,
  getVibeDir,
} from '../../infra/lib/config/GlobalConfigManager.js';
import type { TelegramChannelConfig } from '../types.js';

const TELEGRAM_PID_FILE = path.join(getVibeDir(), 'telegram.pid');
const TELEGRAM_LOG_DIR = path.join(getVibeDir(), 'logs');

function loadConfig(): TelegramChannelConfig | null {
  return readGlobalConfig().channels?.telegram ?? null;
}

function saveConfig(config: TelegramChannelConfig): void {
  patchGlobalConfig({ channels: { telegram: config } });
}

export function telegramSetup(token?: string): void {
  if (!token) {
    console.log('Usage: vibe telegram setup <bot-token>');
    console.log('  Get a token from @BotFather on Telegram');
    return;
  }

  const existing = loadConfig();
  const config: TelegramChannelConfig = {
    botToken: token,
    allowedChatIds: existing?.allowedChatIds ?? [],
  };

  saveConfig(config);
  console.log('Telegram bot token saved');
  if ((config.allowedChatIds ?? []).length === 0) {
    console.log('No allowed chat IDs set. Use: vibe telegram chat <chat-id>');
  }
}

export function telegramChat(chatId?: string): void {
  if (!chatId) {
    console.log('Usage: vibe telegram chat <chat-id>');
    console.log('  Add a Telegram chat ID to the allow list');
    return;
  }

  const config = loadConfig();
  if (!config) {
    console.log('Telegram not configured. Run: vibe telegram setup <bot-token>');
    return;
  }

  const chatIds = config.allowedChatIds ?? [];
  if (chatIds.includes(chatId)) {
    console.log(`Chat ID "${chatId}" is already in the allow list`);
    return;
  }

  chatIds.push(chatId);
  config.allowedChatIds = chatIds;
  saveConfig(config);
  console.log(`Chat ID "${chatId}" added to allow list`);
}

export function telegramStatus(): void {
  const config = loadConfig();
  if (!config) {
    console.log('Telegram: not configured');
    return;
  }

  const token = config.botToken ?? '';
  const tokenPreview = token.slice(0, 8) + '...' + token.slice(-4);
  console.log(`Telegram Bot: configured (${tokenPreview})`);
  const chatIds = config.allowedChatIds ?? [];
  console.log(`Allowed chats: ${chatIds.length > 0 ? chatIds.join(', ') : 'none'}`);
}

function readPid(): number | null {
  try {
    if (!fs.existsSync(TELEGRAM_PID_FILE)) return null;
    const pid = parseInt(fs.readFileSync(TELEGRAM_PID_FILE, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function ensurePlaywright(): boolean {
  const selfDir = path.dirname(url.fileURLToPath(import.meta.url));
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'playwright'),
    path.resolve(selfDir, '..', '..', '..', 'node_modules', 'playwright'),
  ];
  const found = candidates.some((p) => fs.existsSync(p));
  if (found) return true;

  console.log('Playwright not installed. Starting auto-install...');

  try {
    child_process.execSync('npm install playwright', {
      stdio: 'inherit',
      timeout: 120_000,
    });
    child_process.execSync('npx playwright install chromium', {
      stdio: 'inherit',
      timeout: 300_000,
    });
    console.log('Playwright installed!');
    return true;
  } catch {
    console.warn('Playwright auto-install failed. Starting without screenshot support.');
    return false;
  }
}

export function telegramStart(): void {
  const existingPid = readPid();
  if (existingPid !== null && isProcessRunning(existingPid)) {
    console.log(`Telegram bridge is already running (PID: ${existingPid})`);
    return;
  }

  if (existingPid !== null) {
    try { fs.unlinkSync(TELEGRAM_PID_FILE); } catch { /* ignore */ }
  }

  const config = loadConfig();
  if (!config) {
    console.log('Telegram not configured. Run: vibe telegram setup <bot-token>');
    return;
  }
  if (!config.botToken) {
    console.log('Bot token not set. Run: vibe telegram setup <bot-token>');
    return;
  }
  if (!config.allowedChatIds || config.allowedChatIds.length === 0) {
    console.log('No allowed chat IDs. Run: vibe telegram chat <chat-id>');
    return;
  }

  ensurePlaywright();

  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const bridgePath = path.resolve(__dirname, '..', '..', 'bridge', 'telegram-assistant-bridge.js');

  if (!fs.existsSync(bridgePath)) {
    console.error(`Bridge module not found: ${bridgePath}`);
    console.error('Run "npm run build" first.');
    return;
  }

  if (!fs.existsSync(TELEGRAM_LOG_DIR)) {
    fs.mkdirSync(TELEGRAM_LOG_DIR, { recursive: true, mode: 0o700 });
  }

  const logFile = path.join(TELEGRAM_LOG_DIR, 'telegram.log');
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');

  const child = child_process.fork(bridgePath, [], {
    detached: true,
    stdio: ['ignore', out, err, 'ipc'],
    env: { ...process.env, VIBE_TELEGRAM: '1' },
  });

  const pid = child.pid;
  if (pid) {
    fs.writeFileSync(TELEGRAM_PID_FILE, String(pid), { mode: 0o600 });
  }

  child.unref();
  child.disconnect();

  setTimeout(() => {
    const savedPid = readPid();
    if (savedPid !== null && isProcessRunning(savedPid)) {
      console.log(`Telegram bridge started (PID: ${savedPid})`);
      console.log(`Log: ${logFile}`);
    } else {
      console.error('Telegram bridge failed to start. Check log: ' + logFile);
    }
  }, 1500);
}

export function telegramStop(): void {
  const pid = readPid();
  if (pid === null || !isProcessRunning(pid)) {
    console.log('Telegram bridge is not running');
    if (pid !== null) {
      try { fs.unlinkSync(TELEGRAM_PID_FILE); } catch { /* ignore */ }
    }
    return;
  }

  console.log(`Stopping Telegram bridge (PID: ${pid})...`);

  try {
    process.kill(pid, 'SIGTERM');
  } catch { /* Process already gone */ }

  let checks = 0;
  const interval = setInterval(() => {
    checks++;
    if (!isProcessRunning(pid)) {
      clearInterval(interval);
      try { fs.unlinkSync(TELEGRAM_PID_FILE); } catch { /* ignore */ }
      console.log('Telegram bridge stopped');
    } else if (checks >= 10) {
      clearInterval(interval);
      try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ }
      try { fs.unlinkSync(TELEGRAM_PID_FILE); } catch { /* ignore */ }
      console.log('Telegram bridge force-stopped');
    }
  }, 500);
}

export function telegramHelp(): void {
  console.log(`
Vibe Telegram Commands:
  vibe telegram setup <token>    Set bot token
  vibe telegram chat <id>        Add allowed chat ID
  vibe telegram status           Show configuration
  vibe telegram help             Show this help

Start/Stop:
  vibe start                     Start daemon + all interfaces
  vibe interface enable telegram  Enable telegram only

Get a bot token from @BotFather on Telegram.
  `);
}
