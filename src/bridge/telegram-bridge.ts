#!/usr/bin/env node
/**
 * Telegram ↔ Claude Code Bridge
 * 텔레그램 메시지를 Claude에게 전달하고 응답을 돌려보냄
 *
 * 설정: ~/.vibe/telegram.json (vibe telegram setup/chat으로 관리)
 * 실행: vibe telegram start
 */

import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TelegramBot } from '../interface/telegram/TelegramBot.js';
import { LogLevel } from '../daemon/types.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const CONFIG_PATH = path.join(VIBE_DIR, 'telegram.json');

interface TelegramBridgeConfig {
  botToken: string;
  allowedChatIds: string[];
}

// 설정 파일 로드
function loadConfig(): TelegramBridgeConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('설정 파일이 없습니다. 먼저 실행: vibe telegram setup <token>');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as TelegramBridgeConfig;

  if (!config.botToken) {
    console.error('botToken이 설정되지 않았습니다.');
    process.exit(1);
  }

  if (!config.allowedChatIds || config.allowedChatIds.length === 0) {
    console.error('허용된 Chat ID가 없습니다. 먼저 실행: vibe telegram chat <id>');
    process.exit(1);
  }

  return config;
}

// Claude CLI 경로 탐색 (크로스플랫폼)
function findClaude(): string {
  const isWindows = os.platform() === 'win32';
  const home = os.homedir();

  const candidates = isWindows
    ? [
        path.join(home, '.local', 'bin', 'claude.exe'),
        path.join(home, 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
        path.join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
        'claude',
      ]
    : [
        path.join(home, '.local', 'bin', 'claude'),
        '/usr/local/bin/claude',
        '/opt/homebrew/bin/claude',
        'claude',
      ];

  for (const p of candidates) {
    if (p === 'claude' || fs.existsSync(p)) return p;
  }
  return 'claude';
}

const CLAUDE_PATH = findClaude();

const logger = (level: LogLevel, msg: string, _data?: unknown): void => {
  const ts = new Date().toISOString().slice(11, 19);
  if (level !== 'debug') {
    console.log(`[${ts}] [${level}] ${msg}`);
  }
};

/** Claude CLI에 프롬프트를 보내고 응답 받기 */
function askClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt, '--model', 'sonnet', '--max-turns', '1'];

    logger('info', `Claude에게 전달 중... (${prompt.length}자)`);

    execFile(CLAUDE_PATH, args, {
      timeout: 120000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env },
    }, (error, stdout) => {
      if (error) {
        reject(new Error(error.killed ? '응답 시간 초과 (2분)' : error.message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function main(): Promise<void> {
  const config = loadConfig();

  const bot = new TelegramBot(
    {
      botToken: config.botToken,
      allowedChatIds: config.allowedChatIds,
      pollingTimeout: 10,
    },
    logger
  );

  let processing = false;

  bot.onMessage(async (message) => {
    if (message.content.startsWith('/start')) {
      await bot.sendResponse({
        chatId: message.chatId,
        channel: 'telegram',
        content: 'Vibe Bot 연결 완료!\n\n메시지를 보내면 Claude가 응답합니다.',
        messageId: message.id,
        format: 'text',
      });
      return;
    }

    if (processing) {
      await bot.sendResponse({
        chatId: message.chatId,
        channel: 'telegram',
        content: '이전 요청 처리 중... 잠시 후 다시 보내주세요.',
        messageId: message.id,
        format: 'text',
      });
      return;
    }

    logger('info', `받은 메시지: "${message.content.slice(0, 50)}"`);
    processing = true;

    try {
      const response = await askClaude(message.content);
      logger('info', `Claude 응답 (${response.length}자)`);

      await bot.sendResponse({
        chatId: message.chatId,
        channel: 'telegram',
        content: response,
        messageId: message.id,
        format: 'markdown',
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger('error', errMsg);
      await bot.sendResponse({
        chatId: message.chatId,
        channel: 'telegram',
        content: `오류: ${errMsg}`,
        messageId: message.id,
        format: 'text',
      });
    } finally {
      processing = false;
    }
  });

  logger('info', 'Telegram-Claude Bridge 시작 중...');
  await bot.start();
  logger('info', '연결 완료! 텔레그램 메시지 대기 중...');

  // 크로스플랫폼 종료 시그널 처리
  const shutdown = async (): Promise<void> => {
    logger('info', '종료 중...');
    await bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('봇 시작 실패:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
