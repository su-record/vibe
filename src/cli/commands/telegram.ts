/**
 * CLI Commands: vibe telegram <subcommand>
 * Phase 4: External Interface
 */

import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as url from 'node:url';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const TELEGRAM_CONFIG_FILE = path.join(VIBE_DIR, 'telegram.json');
const TELEGRAM_PID_FILE = path.join(VIBE_DIR, 'telegram.pid');
const TELEGRAM_LOG_DIR = path.join(VIBE_DIR, 'logs');

interface TelegramCliConfig {
  botToken: string;
  allowedChatIds: string[];
}

function loadConfig(): TelegramCliConfig | null {
  try {
    if (!fs.existsSync(TELEGRAM_CONFIG_FILE)) return null;
    return JSON.parse(fs.readFileSync(TELEGRAM_CONFIG_FILE, 'utf-8')) as TelegramCliConfig;
  } catch {
    return null;
  }
}

function saveConfig(config: TelegramCliConfig): void {
  if (!fs.existsSync(VIBE_DIR)) {
    fs.mkdirSync(VIBE_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(TELEGRAM_CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function telegramSetup(token?: string): void {
  if (!token) {
    console.log('Usage: vibe telegram setup <bot-token>');
    console.log('  Get a token from @BotFather on Telegram');
    return;
  }

  const existing = loadConfig();
  const config: TelegramCliConfig = {
    botToken: token,
    allowedChatIds: existing?.allowedChatIds || [],
  };

  saveConfig(config);
  console.log('Telegram bot token saved');
  if (config.allowedChatIds.length === 0) {
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

  if (config.allowedChatIds.includes(chatId)) {
    console.log(`Chat ID "${chatId}" is already in the allow list`);
    return;
  }

  config.allowedChatIds.push(chatId);
  saveConfig(config);
  console.log(`Chat ID "${chatId}" added to allow list`);
}

export function telegramStatus(): void {
  const config = loadConfig();
  if (!config) {
    console.log('Telegram: not configured');
    return;
  }

  const tokenPreview = config.botToken.slice(0, 8) + '...' + config.botToken.slice(-4);
  console.log(`Telegram Bot: configured (${tokenPreview})`);
  console.log(`Allowed chats: ${config.allowedChatIds.length > 0 ? config.allowedChatIds.join(', ') : 'none'}`);
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
  // Check if playwright exists in node_modules
  const selfDir = path.dirname(url.fileURLToPath(import.meta.url));
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'playwright'),
    path.resolve(selfDir, '..', '..', '..', 'node_modules', 'playwright'),
  ];
  const found = candidates.some((p) => fs.existsSync(p));
  if (found) return true;

  console.log('Playwright가 설치되어 있지 않습니다. 자동 설치를 시작합니다...');
  console.log('(스크린샷/웹 캡처 기능에 필요합니다)');

  try {
    child_process.execSync('npm install playwright', {
      stdio: 'inherit',
      timeout: 120_000,
    });
    console.log('Playwright 설치 완료. Chromium 브라우저를 설치합니다...');
    child_process.execSync('npx playwright install chromium', {
      stdio: 'inherit',
      timeout: 300_000,
    });
    console.log('Chromium 설치 완료!');
    return true;
  } catch (err) {
    console.warn(
      'Playwright 자동 설치 실패. 스크린샷 기능 없이 시작합니다.',
    );
    console.warn(
      '수동 설치: npm install playwright && npx playwright install chromium',
    );
    return false;
  }
}

export function telegramStart(): void {
  // Check if already running
  const existingPid = readPid();
  if (existingPid !== null && isProcessRunning(existingPid)) {
    console.log(`Telegram bridge is already running (PID: ${existingPid})`);
    return;
  }

  // Clean stale PID
  if (existingPid !== null) {
    try { fs.unlinkSync(TELEGRAM_PID_FILE); } catch { /* ignore */ }
  }

  // Validate config
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

  // Auto-install Playwright if missing (non-blocking: starts even if install fails)
  ensurePlaywright();

  // Find bridge entry point
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const bridgePath = path.resolve(__dirname, '..', '..', 'bridge', 'telegram-assistant-bridge.js');

  if (!fs.existsSync(bridgePath)) {
    console.error(`Bridge module not found: ${bridgePath}`);
    console.error('Run "npm run build" first.');
    return;
  }

  // Ensure log directory
  if (!fs.existsSync(TELEGRAM_LOG_DIR)) {
    fs.mkdirSync(TELEGRAM_LOG_DIR, { recursive: true, mode: 0o700 });
  }

  const logFile = path.join(TELEGRAM_LOG_DIR, 'telegram.log');
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');

  // Fork bridge as detached process
  const child = child_process.fork(bridgePath, [], {
    detached: true,
    stdio: ['ignore', out, err, 'ipc'],
    env: { ...process.env, VIBE_TELEGRAM: '1' },
  });

  // Save PID
  const pid = child.pid;
  if (pid) {
    fs.writeFileSync(TELEGRAM_PID_FILE, String(pid), { mode: 0o600 });
  }

  child.unref();
  child.disconnect();

  // Verify after brief wait
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
    // Clean stale PID
    if (pid !== null) {
      try { fs.unlinkSync(TELEGRAM_PID_FILE); } catch { /* ignore */ }
    }
    return;
  }

  console.log(`Stopping Telegram bridge (PID: ${pid})...`);

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Process already gone
  }

  // Wait for process to exit
  let checks = 0;
  const interval = setInterval(() => {
    checks++;
    if (!isProcessRunning(pid)) {
      clearInterval(interval);
      try { fs.unlinkSync(TELEGRAM_PID_FILE); } catch { /* ignore */ }
      console.log('Telegram bridge stopped');
    } else if (checks >= 10) {
      clearInterval(interval);
      // Force kill
      try {
        process.kill(pid, 'SIGKILL');
      } catch { /* ignore */ }
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
  vibe start                     데몬 + 모든 인터페이스 시작
  vibe interface enable telegram 텔레그램만 활성화

Get a bot token from @BotFather on Telegram.
  `);
}
