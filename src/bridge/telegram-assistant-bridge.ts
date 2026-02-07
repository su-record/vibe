#!/usr/bin/env node
/**
 * Model A Bridge - Telegram AI Assistant
 * Replaces telegram-bridge.ts with ModelARouter architecture
 *
 * Run: vibe telegram start
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TelegramBot } from '../interface/telegram/TelegramBot.js';
import { LogLevel } from '../daemon/types.js';
import { ExternalResponse, InterfaceLogger } from '../interface/types.js';
import { ModelARouter } from '../router/ModelARouter.js';
import { DevRoute } from '../router/routes/DevRoute.js';
import { RepoResolver } from '../router/resolvers/RepoResolver.js';
import { DevSessionManager } from '../router/sessions/DevSessionManager.js';
import { RouterConfig, DEFAULT_ROUTER_CONFIG, InlineKeyboardButton } from '../router/types.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const TELEGRAM_CONFIG_PATH = path.join(VIBE_DIR, 'telegram.json');
const ROUTER_CONFIG_PATH = path.join(VIBE_DIR, 'router.json');

interface TelegramBridgeConfig {
  botToken: string;
  allowedChatIds: string[];
}

// ============================================================================
// Logger
// ============================================================================

const logger: InterfaceLogger = (level: LogLevel, msg: string, _data?: unknown): void => {
  const ts = new Date().toISOString().slice(11, 19);
  if (level !== 'debug') {
    console.log(`[${ts}] [${level}] ${msg}`);
  }
};

// ============================================================================
// Config Loading
// ============================================================================

function loadTelegramConfig(): TelegramBridgeConfig {
  if (!fs.existsSync(TELEGRAM_CONFIG_PATH)) {
    console.error('설정 파일이 없습니다. 먼저 실행: vibe telegram setup <token>');
    process.exit(1);
  }

  const config = JSON.parse(
    fs.readFileSync(TELEGRAM_CONFIG_PATH, 'utf-8'),
  ) as TelegramBridgeConfig;

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

function loadRouterConfig(): RouterConfig {
  try {
    if (fs.existsSync(ROUTER_CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(ROUTER_CONFIG_PATH, 'utf-8'));
      return { ...DEFAULT_ROUTER_CONFIG, ...raw };
    }
  } catch (err) {
    logger('warn', `Failed to load router config: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { ...DEFAULT_ROUTER_CONFIG };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const telegramConfig = loadTelegramConfig();
  const routerConfig = loadRouterConfig();

  // Initialize TelegramBot
  const bot = new TelegramBot(
    {
      botToken: telegramConfig.botToken,
      allowedChatIds: telegramConfig.allowedChatIds,
      pollingTimeout: 10,
    },
    logger,
  );

  // Initialize Router
  const router = new ModelARouter(logger, routerConfig);

  // Wire up Telegram send functions
  router.setSendResponse(async (response: ExternalResponse) => {
    await bot.sendResponse(response);
  });

  // Initialize notification manager send function
  router.getNotificationManager().setSendFunction(async (chatId, text) => {
    await bot.sendResponse({
      messageId: '',
      channel: 'telegram',
      chatId,
      content: text,
      format: 'markdown',
    });
  });

  // Initialize routes
  const repoResolver = new RepoResolver(logger, routerConfig.repos);
  const sessionManager = new DevSessionManager(logger);

  const devRoute = new DevRoute(
    logger,
    repoResolver,
    sessionManager,
    router.getNotificationManager(),
  );

  router.getRegistry().register(devRoute);

  // Try to initialize SmartRouter (optional)
  await initSmartRouter(router);

  // Wire message handler
  bot.onMessage(async (message) => {
    // Handle /start command
    if (message.content.startsWith('/start')) {
      await bot.sendResponse({
        chatId: message.chatId,
        channel: 'telegram',
        content: '🤖 Model A 연결 완료!\n\n자연어로 명령을 보내주세요.',
        messageId: message.id,
        format: 'text',
      });
      return;
    }

    await router.handleMessage(message);
  });

  // Start bot
  logger('info', 'Model A Bridge 시작 중...');
  await bot.start();
  logger('info', '연결 완료! 텔레그램 메시지 대기 중...');

  // Start notification batch timer
  router.getNotificationManager().startBatchTimer();

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    logger('info', '종료 중...');
    router.getNotificationManager().stop();
    await sessionManager.closeAll();
    await bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/** Try to initialize SmartRouter for LLM classification */
async function initSmartRouter(router: ModelARouter): Promise<void> {
  try {
    const { SmartRouter } = await import('../orchestrator/SmartRouter.js');
    const smartRouter = new SmartRouter();
    router.setSmartRouter(smartRouter);
    logger('info', 'SmartRouter initialized');
  } catch (err) {
    logger('warn', 'SmartRouter initialization failed (LLM classification disabled)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

main().catch((err) => {
  console.error('Model A 시작 실패:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
