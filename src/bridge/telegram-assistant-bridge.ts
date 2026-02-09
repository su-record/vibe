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
import { GoogleRoute } from '../router/routes/GoogleRoute.js';
import { ResearchRoute } from '../router/routes/ResearchRoute.js';
import { UtilityRoute } from '../router/routes/UtilityRoute.js';
import { MonitorRoute } from '../router/routes/MonitorRoute.js';
import { CompositeRoute } from '../router/routes/CompositeRoute.js';
import { BrowseRoute } from '../router/routes/BrowseRoute.js';
import { BrowserAgent } from '../router/browser/BrowserAgent.js';
import { RepoResolver } from '../router/resolvers/RepoResolver.js';
import { DevSessionManager } from '../router/sessions/DevSessionManager.js';
import { GoogleAuthManager } from '../router/services/GoogleAuthManager.js';
import { BookmarkService } from '../router/services/BookmarkService.js';
import { NoteService } from '../router/services/NoteService.js';
import { SchedulerEngine } from '../router/services/SchedulerEngine.js';
import { DailyReportGenerator } from '../router/services/DailyReportGenerator.js';
import { BrowserManager } from '../router/browser/BrowserManager.js';
import { BrowserPool } from '../router/browser/BrowserPool.js';
import { RouterConfig, DEFAULT_ROUTER_CONFIG, InlineKeyboardButton, SmartRouterLike } from '../router/types.js';
import { HeadModelSelector } from '../agent/HeadModelSelector.js';
import { AgentLoop } from '../agent/AgentLoop.js';
import { getAllTools } from '../agent/tools/index.js';

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

  // Wire up inline keyboard send function
  router.setSendInlineKeyboard(async (chatId, text, buttons) => {
    return bot.sendInlineKeyboard(chatId, text, buttons);
  });

  // Wire up callback query handler
  bot.onCallbackQuery(async (chatId, data, _callbackQueryId) => {
    router.handleCallbackQuery(chatId, data);
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
  const smartRouter = await initSmartRouter(router);

  // Initialize AgentLoop (function-calling agent)
  const headSelector = new HeadModelSelector();
  const tools = getAllTools();

  const agentLoop = new AgentLoop({
    headSelector,
    tools,
    systemPromptConfig: { userName: '사용자', language: 'ko', timezone: 'Asia/Seoul' },
    mediaPreprocessorConfig: { showConfirmation: true },
  });
  router.setAgentLoop(agentLoop);
  logger('info', `AgentLoop 초기화 완료 (도구 ${tools.length}개 등록)`);

  // Google Route (works without SmartRouter)
  const googleAuth = new GoogleAuthManager(logger);
  const googleRoute = new GoogleRoute(logger, googleAuth, smartRouter ?? undefined);
  router.getRegistry().register(googleRoute);

  // Browser pool for utility route
  const browserManager = new BrowserManager(logger);
  const browserPool = new BrowserPool(logger, browserManager);

  // Routes that require SmartRouter
  let scheduler: SchedulerEngine | undefined;
  if (smartRouter) {
    // Research Route
    const bookmarkService = new BookmarkService(logger);
    const researchRoute = new ResearchRoute(logger, smartRouter, bookmarkService);
    router.getRegistry().register(researchRoute);

    // Utility Route
    const noteService = new NoteService(logger, undefined, smartRouter);
    const utilityRoute = new UtilityRoute(logger, smartRouter, noteService);
    router.getRegistry().register(utilityRoute);

    // Monitor Route
    scheduler = new SchedulerEngine(logger, smartRouter);
    const reportGen = new DailyReportGenerator(logger, smartRouter, noteService);
    const monitorRoute = new MonitorRoute(logger, smartRouter, scheduler, reportGen);
    router.getRegistry().register(monitorRoute);

    // Composite Route
    const compositeRoute = new CompositeRoute(logger, smartRouter, router.getNotificationManager());
    router.getRegistry().register(compositeRoute);

    // Browse Route (uses user's Chrome profile)
    const userBrowserManager = new BrowserManager(logger, { useUserProfile: true });
    const browseAgent = new BrowserAgent(logger, smartRouter, userBrowserManager);
    const browseRoute = new BrowseRoute(logger, browseAgent);
    router.getRegistry().register(browseRoute);

    logger('info', `라우트 등록 완료: dev, google, research, utility, monitor, composite, browse`);
  } else {
    logger('warn', 'SmartRouter 없음 — dev, google 라우트만 활성');
  }

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
    if (scheduler) await scheduler.shutdown();
    await browserPool.closeAll();
    await sessionManager.closeAll();
    await bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/** Try to initialize SmartRouter for LLM classification */
async function initSmartRouter(router: ModelARouter): Promise<SmartRouterLike | null> {
  try {
    const { SmartRouter } = await import('../orchestrator/SmartRouter.js');
    const smartRouter = new SmartRouter();
    router.setSmartRouter(smartRouter);
    logger('info', 'SmartRouter initialized');
    return smartRouter as unknown as SmartRouterLike;
  } catch (err) {
    logger('warn', 'SmartRouter initialization failed (LLM classification disabled)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

main().catch((err) => {
  console.error('Model A 시작 실패:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
