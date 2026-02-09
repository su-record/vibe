/**
 * Preflight Check System
 * Phase 1: Task 4.3
 *
 * Pre-startup validation for daemon requirements:
 * - HeadModel API keys
 * - Channel-specific configurations
 * - Port availability
 * - Database accessibility
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as net from 'node:net';

const VIBE_DIR = path.join(os.homedir(), '.vibe');

export interface PreflightResult {
  passed: boolean;
  errors: PreflightItem[];
  warnings: PreflightItem[];
}

export interface PreflightItem {
  check: string;
  message: string;
  resolution?: string;
}

export async function runPreflight(): Promise<PreflightResult> {
  const errors: PreflightItem[] = [];
  const warnings: PreflightItem[] = [];

  // 1. HeadModel API key check
  checkHeadModelApiKey(errors, warnings);

  // 2. Channel-specific checks
  checkChannelConfigs(errors, warnings);

  // 3. Web port availability (only if web is enabled)
  await checkWebPort(errors, warnings);

  // 4. SQLite DB accessibility
  checkDatabaseAccess(errors, warnings);

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

function checkHeadModelApiKey(errors: PreflightItem[], warnings: PreflightItem[]): void {
  // Check GPT API key
  const gptKeyPath = path.join(VIBE_DIR, 'gpt-api-key');
  const gptOAuthPath = path.join(VIBE_DIR, 'gpt_tokens.json');
  const hasGptKey = fs.existsSync(gptKeyPath) || process.env.OPENAI_API_KEY;
  const hasOAuth = fs.existsSync(gptOAuthPath);

  if (!hasGptKey && !hasOAuth) {
    warnings.push({
      check: 'head-model-api-key',
      message: 'GPT API 키가 설정되지 않았습니다 (Claude fallback 사용)',
      resolution: 'vibe gpt auth 또는 vibe gpt key <key> 실행',
    });
  }
}

function checkChannelConfigs(errors: PreflightItem[], warnings: PreflightItem[]): void {
  // Telegram
  if (process.env.VIBE_TELEGRAM_ENABLED === 'true' || process.env.VIBE_TELEGRAM_ENABLED === '1') {
    const configPath = path.join(VIBE_DIR, 'telegram.json');
    if (!fs.existsSync(configPath)) {
      errors.push({
        check: 'telegram-config',
        message: 'Telegram 설정 파일이 없습니다',
        resolution: 'vibe telegram setup <token> 실행',
      });
    }
  }

  // Slack
  if (process.env.VIBE_SLACK_ENABLED === 'true' || process.env.VIBE_SLACK_ENABLED === '1') {
    if (!process.env.SLACK_BOT_TOKEN) {
      errors.push({
        check: 'slack-bot-token',
        message: 'SLACK_BOT_TOKEN이 설정되지 않았습니다',
        resolution: 'SLACK_BOT_TOKEN 환경변수 설정',
      });
    }
    if (!process.env.SLACK_APP_TOKEN) {
      errors.push({
        check: 'slack-app-token',
        message: 'SLACK_APP_TOKEN이 설정되지 않았습니다',
        resolution: 'SLACK_APP_TOKEN 환경변수 설정',
      });
    }
  }

  // iMessage
  if (process.env.VIBE_IMESSAGE_ENABLED === 'true' || process.env.VIBE_IMESSAGE_ENABLED === '1') {
    if (process.platform !== 'darwin') {
      warnings.push({
        check: 'imessage-platform',
        message: 'iMessage는 macOS에서만 지원됩니다',
        resolution: 'macOS에서 실행하거나 VIBE_IMESSAGE_ENABLED=false 설정',
      });
    }
  }

  // Vision
  if (process.env.VIBE_VISION_ENABLED === 'true' || process.env.VIBE_VISION_ENABLED === '1') {
    if (!process.env.GEMINI_API_KEY) {
      const keyPath = path.join(VIBE_DIR, 'gemini-api-key');
      if (!fs.existsSync(keyPath)) {
        errors.push({
          check: 'gemini-api-key',
          message: 'GEMINI_API_KEY가 설정되지 않았습니다',
          resolution: 'vibe gemini key <key> 실행',
        });
      }
    }
  }
}

async function checkWebPort(errors: PreflightItem[], _warnings: PreflightItem[]): Promise<void> {
  const port = parseInt(process.env.VIBE_WEB_PORT ?? '7860', 10);

  // Only check if web is enabled
  if (process.env.VIBE_WEB_ENABLED !== 'true' && process.env.VIBE_WEB_ENABLED !== '1') {
    return;
  }

  const inUse = await isPortInUse(port);
  if (inUse) {
    errors.push({
      check: 'web-port',
      message: `포트 ${port}이 이미 사용 중입니다`,
      resolution: `기존 프로세스를 종료하거나 VIBE_WEB_PORT 환경변수를 변경하세요`,
    });
  }
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

function checkDatabaseAccess(errors: PreflightItem[], _warnings: PreflightItem[]): void {
  const dbPath = path.join(VIBE_DIR, 'conversations.db');

  // Check if .vibe directory exists and is writable
  if (!fs.existsSync(VIBE_DIR)) {
    try {
      fs.mkdirSync(VIBE_DIR, { recursive: true, mode: 0o700 });
    } catch {
      errors.push({
        check: 'database-access',
        message: `~/.vibe 디렉토리를 생성할 수 없습니다`,
        resolution: `mkdir -p ~/.vibe && chmod 700 ~/.vibe 실행`,
      });
    }
  }

  // If DB exists, check if it's writable
  if (fs.existsSync(dbPath)) {
    try {
      fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      errors.push({
        check: 'database-write',
        message: `데이터베이스 파일에 쓸 수 없습니다: ${dbPath}`,
        resolution: `chmod 600 ${dbPath} 실행`,
      });
    }
  }
}
