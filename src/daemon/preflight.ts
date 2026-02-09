/**
 * Preflight Check System
 * Phase 1: Task 4.3
 *
 * Pre-startup validation for daemon requirements:
 * - HeadModel API keys
 * - Channel-specific configurations
 * - Port availability
 * - Database accessibility
 * - macOS system permissions (Full Disk Access, Screen Recording, Accessibility)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as net from 'node:net';
import { execSync } from 'node:child_process';

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

  // 5. macOS system permissions
  if (process.platform === 'darwin') {
    checkMacOSPermissions(errors, warnings);
  }

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

function checkMacOSPermissions(errors: PreflightItem[], warnings: PreflightItem[]): void {
  // OpenClaw pattern: Don't trigger TCC prompts in preflight (they'd attach to the parent
  // process — Terminal/Cursor/IDE, not Vibe). Instead:
  //   1. Check binary/tool availability (non-TCC, safe)
  //   2. Inform user which permissions are needed + System Settings URL
  //   3. Let actual usage handle permission failures with clear error messages

  // 1. iMessage: imsg binary availability (Full Disk Access is on imsg, not Node)
  if (process.env.VIBE_IMESSAGE_ENABLED === 'true' || process.env.VIBE_IMESSAGE_ENABLED === '1') {
    checkImsgBinary(errors);
  }

  // 2. Browser automation — Playwright availability + permission guidance
  if (process.env.VIBE_BROWSER_ENABLED === 'true' || process.env.VIBE_BROWSER_ENABLED === '1') {
    checkPlaywrightAvailable(errors, warnings);
    warnAccessibility(warnings);
  }
}

/** Check imsg binary exists. Full Disk Access is granted to imsg, not to Node/Vibe. */
function checkImsgBinary(errors: PreflightItem[]): void {
  try {
    execSync('which imsg', { stdio: 'pipe', timeout: 3000 });
  } catch {
    errors.push({
      check: 'imsg-binary',
      message: 'imsg CLI가 설치되어 있지 않습니다',
      resolution: 'brew install plentyofcode/tap/imsg 또는 imsg 바이너리를 PATH에 추가\n'
        + '  설치 후 Full Disk Access 권한 필요:\n'
        + '  open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"',
    });
  }
}

/** Inform user that Accessibility permission is needed for browser automation */
function warnAccessibility(warnings: PreflightItem[]): void {
  warnings.push({
    check: 'accessibility',
    message: '브라우저 자동화 시 Accessibility 권한이 필요할 수 있습니다',
    resolution: '시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용 → 터미널 앱 추가\n'
      + '  open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"',
  });
}

/** Check Playwright + Chromium installed for browser automation */
function checkPlaywrightAvailable(errors: PreflightItem[], warnings: PreflightItem[]): void {
  // Check playwright module (fast, no TCC trigger)
  const playwrightDir = path.join(process.cwd(), 'node_modules', 'playwright');
  if (!fs.existsSync(playwrightDir)) {
    errors.push({
      check: 'playwright',
      message: 'Playwright가 설치되어 있지 않습니다',
      resolution: 'npm install playwright && npx playwright install chromium',
    });
    return;
  }

  // Check if chromium binary is downloaded
  const chromiumMarker = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  if (!fs.existsSync(chromiumMarker)) {
    warnings.push({
      check: 'playwright-chromium',
      message: 'Playwright Chromium 브라우저가 다운로드되지 않았습니다',
      resolution: 'npx playwright install chromium',
    });
  }
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
