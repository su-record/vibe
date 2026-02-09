/**
 * CLI Commands: vibe imessage <subcommand>
 * Phase 4: External Interface
 *
 * Stores iMessage config in ~/.vibe/imessage.json
 * Same pattern as vibe telegram / vibe slack.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const IMESSAGE_CONFIG_FILE = path.join(VIBE_DIR, 'imessage.json');

interface IMessageCliConfig {
  allowedHandles: string[];
}

function loadConfig(): IMessageCliConfig | null {
  try {
    if (!fs.existsSync(IMESSAGE_CONFIG_FILE)) return null;
    return JSON.parse(fs.readFileSync(IMESSAGE_CONFIG_FILE, 'utf-8')) as IMessageCliConfig;
  } catch {
    return null;
  }
}

function saveConfig(config: IMessageCliConfig): void {
  if (!fs.existsSync(VIBE_DIR)) {
    fs.mkdirSync(VIBE_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(IMESSAGE_CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function imessageSetup(handle?: string): void {
  if (process.platform !== 'darwin') {
    console.log('iMessage는 macOS에서만 사용할 수 있습니다.');
    return;
  }

  if (!handle) {
    console.log('Usage: vibe imessage setup <handle>');
    console.log('  handle: 전화번호 또는 이메일 (예: +82-10-xxxx-xxxx, me@icloud.com)');
    return;
  }

  const existing = loadConfig();
  const config: IMessageCliConfig = {
    allowedHandles: existing?.allowedHandles || [],
  };

  if (config.allowedHandles.includes(handle)) {
    console.log(`Handle "${handle}"은 이미 등록되어 있습니다.`);
    return;
  }

  config.allowedHandles.push(handle);
  saveConfig(config);
  console.log(`iMessage handle "${handle}" 저장 완료`);
  console.log('Full Disk Access 권한이 필요합니다: 시스템 설정 → 개인 정보 보호 및 보안 → 전체 디스크 접근 권한');
}

export function imessageStatus(): void {
  if (process.platform !== 'darwin') {
    console.log('iMessage는 macOS에서만 사용할 수 있습니다.');
    return;
  }

  const config = loadConfig();
  if (!config || config.allowedHandles.length === 0) {
    console.log('iMessage: 설정되지 않음');
    return;
  }

  console.log(`iMessage: 설정됨`);
  console.log(`허용 핸들: ${config.allowedHandles.join(', ')}`);

  // Check chat.db accessibility
  const chatDbPath = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');
  try {
    fs.accessSync(chatDbPath, fs.constants.R_OK);
    console.log('chat.db 접근: OK');
  } catch {
    console.log('chat.db 접근: 불가 (Full Disk Access 권한 필요)');
  }
}

export function imessageHelp(): void {
  console.log(`
Vibe iMessage Commands:
  vibe imessage setup <handle>   허용 핸들 추가 (전화번호/이메일)
  vibe imessage status           설정 상태 확인
  vibe imessage help             도움말

macOS 전용. Full Disk Access 권한 필요:
  시스템 설정 → 개인 정보 보호 및 보안 → 전체 디스크 접근 권한
  `);
}
