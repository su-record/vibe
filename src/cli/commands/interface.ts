/**
 * CLI Commands: vibe interface <subcommand>
 * Phase 4: External Interface
 *
 * Enable validates prerequisites:
 * - imessage: macOS only
 * - slack: SLACK_BOT_TOKEN + SLACK_APP_TOKEN required
 * - telegram: TELEGRAM_BOT_TOKEN required
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const INTERFACE_CONFIG = path.join(VIBE_DIR, 'interfaces.json');
const TELEGRAM_CONFIG = path.join(VIBE_DIR, 'telegram.json');
const SLACK_CONFIG = path.join(VIBE_DIR, 'slack.json');
const IMESSAGE_CONFIG = path.join(VIBE_DIR, 'imessage.json');

const VALID_INTERFACES = ['telegram', 'web', 'webhook', 'slack', 'imessage'] as const;

interface InterfaceState {
  [name: string]: { enabled: boolean; lastUpdated: string };
}

interface PrereqResult {
  ok: boolean;
  reason?: string;
}

function checkPrerequisites(name: string): PrereqResult {
  switch (name) {
    case 'imessage': {
      if (process.platform !== 'darwin') {
        return { ok: false, reason: 'iMessage는 macOS에서만 사용할 수 있습니다.' };
      }
      // Check env var first, then config file (vibe imessage setup)
      let hasHandles = !!process.env.IMESSAGE_ALLOWED_HANDLES;
      if (!hasHandles) {
        try {
          if (fs.existsSync(IMESSAGE_CONFIG)) {
            const config = JSON.parse(fs.readFileSync(IMESSAGE_CONFIG, 'utf-8'));
            hasHandles = Array.isArray(config?.allowedHandles) && config.allowedHandles.length > 0;
          }
        } catch {
          // ignore parse errors
        }
      }
      if (!hasHandles) {
        return { ok: false, reason: 'iMessage 핸들이 설정되지 않았습니다. vibe imessage setup <handle>로 설정하세요.' };
      }
      return { ok: true };
    }

    case 'slack': {
      // Check env vars first, then config file (vibe slack setup)
      let hasSlackTokens = !!process.env.SLACK_BOT_TOKEN && !!process.env.SLACK_APP_TOKEN;
      if (!hasSlackTokens) {
        try {
          if (fs.existsSync(SLACK_CONFIG)) {
            const config = JSON.parse(fs.readFileSync(SLACK_CONFIG, 'utf-8'));
            hasSlackTokens = !!config?.botToken && !!config?.appToken;
          }
        } catch {
          // ignore parse errors
        }
      }
      if (!hasSlackTokens) {
        return { ok: false, reason: 'Slack 토큰이 설정되지 않았습니다. vibe slack setup <bot-token> <app-token>으로 설정하세요.' };
      }
      return { ok: true };
    }

    case 'telegram': {
      // Check config file first (vibe telegram setup), then env var
      let hasTelegramToken = !!process.env.TELEGRAM_BOT_TOKEN;
      if (!hasTelegramToken) {
        try {
          if (fs.existsSync(TELEGRAM_CONFIG)) {
            const config = JSON.parse(fs.readFileSync(TELEGRAM_CONFIG, 'utf-8'));
            hasTelegramToken = !!config?.botToken;
          }
        } catch {
          // ignore parse errors
        }
      }
      if (!hasTelegramToken) {
        return { ok: false, reason: 'Telegram 토큰이 설정되지 않았습니다. vibe telegram setup <token>으로 설정하세요.' };
      }
      return { ok: true };
    }

    default:
      return { ok: true };
  }
}

function loadState(): InterfaceState {
  try {
    if (!fs.existsSync(INTERFACE_CONFIG)) return {};
    return JSON.parse(fs.readFileSync(INTERFACE_CONFIG, 'utf-8')) as InterfaceState;
  } catch {
    return {};
  }
}

function saveState(state: InterfaceState): void {
  if (!fs.existsSync(VIBE_DIR)) {
    fs.mkdirSync(VIBE_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(INTERFACE_CONFIG, JSON.stringify(state, null, 2));
}

export function interfaceList(): void {
  const state = loadState();

  console.log(`
Active Interfaces:
${'━'.repeat(40)}`);

  for (const name of VALID_INTERFACES) {
    const info = state[name];
    const isEnabled = info?.enabled === true;
    const prereq = checkPrerequisites(name);
    const icon = isEnabled ? '✅' : '❌';
    const prereqNote = !isEnabled && !prereq.ok ? ' (미설정)' : '';
    console.log(`  ${icon} ${name.padEnd(12)} ${isEnabled ? 'enabled' : 'disabled'}${prereqNote}`);
  }

  console.log('━'.repeat(40));
}

export function interfaceEnable(name: string): void {
  if (!name) {
    console.log('Usage: vibe interface enable <name>');
    return;
  }

  if (!VALID_INTERFACES.includes(name as typeof VALID_INTERFACES[number])) {
    console.log(`Unknown interface: ${name}. Available: ${VALID_INTERFACES.join(', ')}`);
    return;
  }

  const prereq = checkPrerequisites(name);
  if (!prereq.ok) {
    console.log(`❌ ${name} 활성화 불가: ${prereq.reason}`);
    return;
  }

  const state = loadState();
  state[name] = { enabled: true, lastUpdated: new Date().toISOString() };
  saveState(state);
  console.log(`✅ Interface "${name}" enabled`);
}

export function interfaceEnableConfigured(): void {
  const state = loadState();
  let enabled = 0;

  for (const name of VALID_INTERFACES) {
    const prereq = checkPrerequisites(name);
    if (prereq.ok) {
      state[name] = { enabled: true, lastUpdated: new Date().toISOString() };
      enabled++;
    }
  }

  saveState(state);
  if (enabled > 0) {
    const names = Object.entries(state)
      .filter(([, v]) => v.enabled)
      .map(([k]) => k);
    console.log(`✅ ${names.join(', ')} 인터페이스 활성화`);
  } else {
    console.log('ℹ️  활성화 가능한 인터페이스가 없습니다.');
  }
}

export function interfaceDisableAll(): void {
  const state = loadState();
  for (const name of VALID_INTERFACES) {
    if (state[name]?.enabled) {
      state[name] = { enabled: false, lastUpdated: new Date().toISOString() };
    }
  }
  saveState(state);
  console.log('모든 인터페이스 비활성화');
}

export function interfaceDisable(name: string): void {
  if (!name) {
    console.log('Usage: vibe interface disable <name>');
    return;
  }

  const state = loadState();
  state[name] = { enabled: false, lastUpdated: new Date().toISOString() };
  saveState(state);
  console.log(`Interface "${name}" disabled`);
}

export function interfaceHelp(): void {
  console.log(`
Vibe Interface Commands:
  vibe interface list                List active interfaces
  vibe interface enable <name>       Enable an interface
  vibe interface disable <name>      Disable an interface
  vibe interface help                Show this help

Interfaces: ${VALID_INTERFACES.join(', ')}

Prerequisites:
  telegram   vibe telegram setup <token>
  slack      vibe slack setup <bot-token> <app-token>
  imessage   macOS only + vibe imessage setup <handle>
  `);
}
