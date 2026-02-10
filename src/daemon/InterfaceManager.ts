/**
 * InterfaceManager - Auto-start enabled interfaces on daemon boot
 *
 * Reads ~/.vibe/interfaces.json and starts enabled interfaces (slack, telegram, etc.)
 * Environment variables provide credentials; interfaces.json controls enabled state.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { LogLevel } from './types.js';
import type { BaseInterface } from '../interface/BaseInterface.js';
import type { ExternalMessage } from '../interface/types.js';
import type { SessionPool } from './SessionPool.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const INTERFACE_CONFIG = path.join(VIBE_DIR, 'interfaces.json');
const TELEGRAM_CONFIG = path.join(VIBE_DIR, 'telegram.json');
const SLACK_CONFIG = path.join(VIBE_DIR, 'slack.json');

/** Global config dir for Google Apps token check */
function getGlobalConfigDir(): string {
  return process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'vibe');
}

interface InterfaceState {
  [name: string]: { enabled: boolean; lastUpdated: string };
}

type Logger = (level: LogLevel, message: string, data?: unknown) => void;

export class InterfaceManager {
  private interfaces: Map<string, BaseInterface> = new Map();
  private logger: Logger;
  private sessionPool?: SessionPool;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /** Attach session pool for message routing */
  setSessionPool(pool: SessionPool): void {
    this.sessionPool = pool;
  }

  async startEnabledInterfaces(): Promise<void> {
    const state = this.loadState();
    const enabledNames = Object.entries(state)
      .filter(([, v]) => v.enabled)
      .map(([k]) => k);

    if (enabledNames.length === 0) {
      this.logger('info', 'No interfaces enabled, skipping interface startup');
      return;
    }

    this.logger('info', `Starting enabled interfaces: ${enabledNames.join(', ')}`);

    for (const name of enabledNames) {
      try {
        await this.startInterface(name);
      } catch (err) {
        this.logger('error', `Failed to start interface "${name}"`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Send startup notification to all connected interfaces
    await this.sendStartupNotification();
  }

  async stopAll(): Promise<void> {
    // Stop browser service
    try {
      const { shutdownBrowserService } = await import('../tools/browser/index.js');
      await shutdownBrowserService();
      this.logger('info', 'Browser service stopped');
    } catch {
      // Browser service may not be initialized — ignore
    }

    // Stop Google service
    try {
      const { shutdownGoogleService } = await import('../tools/google/index.js');
      shutdownGoogleService();
      this.logger('info', 'Google service stopped');
    } catch {
      // Google service may not be initialized — ignore
    }

    // Stop Voice service
    try {
      const { shutdownVoiceService } = await import('../tools/voice/index.js');
      shutdownVoiceService();
      this.logger('info', 'Voice service stopped');
    } catch {
      // Voice service may not be initialized — ignore
    }

    // Stop Vision service
    try {
      const { shutdownVisionService } = await import('../tools/vision/index.js');
      shutdownVisionService();
      this.logger('info', 'Vision service stopped');
    } catch {
      // Vision service may not be initialized — ignore
    }

    // Stop Sandbox service
    try {
      const { shutdownSandboxService } = await import('../tools/sandbox/index.js');
      await shutdownSandboxService();
      this.logger('info', 'Sandbox service stopped');
    } catch {
      // Sandbox service may not be initialized — ignore
    }

    // Stop Integration service
    try {
      const { shutdownIntegrationService } = await import('../tools/integration/index.js');
      await shutdownIntegrationService();
      this.logger('info', 'Integration service stopped');
    } catch {
      // Integration service may not be initialized — ignore
    }

    for (const [name, iface] of this.interfaces) {
      try {
        await iface.stop();
        this.logger('info', `Interface "${name}" stopped`);
      } catch (err) {
        this.logger('warn', `Error stopping interface "${name}"`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    this.interfaces.clear();
  }

  getActiveInterfaces(): Array<{ name: string; status: string }> {
    return Array.from(this.interfaces.entries()).map(([name, iface]) => ({
      name,
      status: iface.getStatus(),
    }));
  }

  private async startInterface(name: string): Promise<void> {
    const ifaceLogger = (level: LogLevel, msg: string, data?: unknown): void => {
      this.logger(level, `[${name}] ${msg}`, data);
    };

    switch (name) {
      case 'slack':
        await this.startSlack(ifaceLogger);
        break;
      case 'telegram':
        await this.startTelegram(ifaceLogger);
        break;
      default:
        this.logger('warn', `Interface "${name}" auto-start not supported`);
    }
  }

  private registerMessageHandler(name: string, iface: BaseInterface): void {
    iface.onMessage(async (message: ExternalMessage) => {
      this.logger('info', `[${name}] Message received from ${message.userId}: ${message.content.slice(0, 100)}`);

      if (!this.sessionPool) {
        this.logger('warn', `[${name}] No session pool attached, cannot process message`);
        await iface.sendResponse({
          messageId: message.id,
          channel: message.channel,
          chatId: message.chatId,
          content: 'Vibe 데몬이 메시지를 수신했으나, 세션 풀이 아직 준비되지 않았습니다.',
          format: 'text',
        });
        return;
      }

      // Voice message → STT 전처리
      let content = message.content;
      if (message.type === 'voice') {
        const transcribed = await this.transcribeVoice(name, iface, message);
        if (!transcribed) return; // 에러 메시지는 transcribeVoice에서 전송
        content = transcribed;
      }

      try {
        const session = this.sessionPool.getOrCreateSession(process.cwd());
        const result = await this.sessionPool.sendRequest(session.id, content);
        await iface.sendResponse({
          messageId: message.id,
          channel: message.channel,
          chatId: message.chatId,
          content: result,
          format: 'markdown',
        });
      } catch (err) {
        this.logger('error', `[${name}] Failed to process message`, {
          error: err instanceof Error ? err.message : String(err),
        });
        await iface.sendResponse({
          messageId: message.id,
          channel: message.channel,
          chatId: message.chatId,
          content: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          format: 'text',
        });
      }
    });
  }

  /**
   * 음성 메시지 → Gemini STT 변환
   * Telegram file download → 임시 파일 → transcribeAudio → 정리
   */
  private async transcribeVoice(
    name: string,
    iface: BaseInterface,
    message: ExternalMessage,
  ): Promise<string | null> {
    const fileId = message.metadata?.telegramFileId as string | undefined;
    if (!fileId) {
      await iface.sendResponse({
        messageId: message.id,
        channel: message.channel,
        chatId: message.chatId,
        content: '음성 파일 정보가 없습니다.',
        format: 'text',
      });
      return null;
    }

    try {
      // 1. Telegram에서 파일 다운로드
      const { TelegramBot } = await import('../interface/telegram/TelegramBot.js');
      if (!(iface instanceof TelegramBot)) {
        return null;
      }

      const audioBuffer = await iface.downloadFile(fileId);
      const mimeType = (message.metadata?.voiceMimeType as string) || 'audio/ogg';
      const ext = mimeType.includes('ogg') ? '.ogg' : '.mp3';

      // 2. 임시 파일 저장
      const tmpDir = path.join(os.tmpdir(), 'vibe-stt');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      const tmpFile = path.join(tmpDir, `voice-${Date.now()}${ext}`);
      fs.writeFileSync(tmpFile, audioBuffer);

      // 3. Gemini STT 변환
      const { transcribeAudio } = await import('../core/lib/gemini/capabilities.js');
      const result = await transcribeAudio(tmpFile, { language: 'Korean' });

      // 4. 임시 파일 정리
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

      const text = result.transcription?.trim();
      if (!text) {
        await iface.sendResponse({
          messageId: message.id,
          channel: message.channel,
          chatId: message.chatId,
          content: '음성을 인식하지 못했습니다. 다시 시도해주세요.',
          format: 'text',
        });
        return null;
      }

      // 5. 인식 결과 확인 메시지
      this.logger('info', `[${name}] Voice transcribed: ${text.slice(0, 100)}`);

      return text;
    } catch (err) {
      this.logger('error', `[${name}] Voice transcription failed`, {
        error: err instanceof Error ? err.message : String(err),
      });
      await iface.sendResponse({
        messageId: message.id,
        channel: message.channel,
        chatId: message.chatId,
        content: '음성 인식에 실패했습니다. 텍스트로 입력해주세요.',
        format: 'text',
      });
      return null;
    }
  }

  private async startSlack(logger: Logger): Promise<void> {
    // Read from env vars first, then config file (vibe slack setup)
    let botToken = process.env.SLACK_BOT_TOKEN;
    let appToken = process.env.SLACK_APP_TOKEN;
    let allowedChannels: string[] = (process.env.SLACK_ALLOWED_CHANNELS || '').split(',').filter(Boolean);

    if (!botToken || !appToken) {
      try {
        if (fs.existsSync(SLACK_CONFIG)) {
          const config = JSON.parse(fs.readFileSync(SLACK_CONFIG, 'utf-8'));
          if (config?.botToken && config?.appToken) {
            botToken = config.botToken;
            appToken = config.appToken;
            if (Array.isArray(config.allowedChannelIds) && config.allowedChannelIds.length > 0) {
              allowedChannels = config.allowedChannelIds;
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    if (!botToken || !appToken) {
      this.logger('warn', 'Slack: missing tokens (env or ~/.vibe/slack.json), skipping');
      return;
    }

    const { SlackBot } = await import('../interface/slack/SlackBot.js');
    const slack = new SlackBot(
      { botToken, appToken, allowedChannelIds: allowedChannels },
      logger,
    );

    await slack.start();
    this.registerMessageHandler('slack', slack);
    this.interfaces.set('slack', slack);
    this.logger('info', 'Slack interface started');
  }

  private async startTelegram(logger: Logger): Promise<void> {
    // Read from config file first (vibe telegram setup), then env var
    let botToken = process.env.TELEGRAM_BOT_TOKEN;
    let allowedChatIds: string[] = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',').filter(Boolean);

    if (!botToken) {
      try {
        if (fs.existsSync(TELEGRAM_CONFIG)) {
          const config = JSON.parse(fs.readFileSync(TELEGRAM_CONFIG, 'utf-8'));
          if (config?.botToken) {
            botToken = config.botToken;
            if (Array.isArray(config.allowedChatIds) && config.allowedChatIds.length > 0) {
              allowedChatIds = config.allowedChatIds;
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    if (!botToken) {
      this.logger('warn', 'Telegram: missing bot token (env or ~/.vibe/telegram.json), skipping');
      return;
    }

    const { TelegramBot } = await import('../interface/telegram/TelegramBot.js');
    const telegram = new TelegramBot(
      { botToken, allowedChatIds },
      logger,
    );

    await telegram.start();
    this.registerMessageHandler('telegram', telegram);
    this.interfaces.set('telegram', telegram);
    this.logger('info', 'Telegram interface started');
  }

  /**
   * 데몬 시작 시 연결된 인터페이스에 알림 전송
   * Google Apps 미인증 시 인라인 버튼으로 인증 요청
   */
  private async sendStartupNotification(): Promise<void> {
    if (this.interfaces.size === 0) return;

    const googleAppsOk = fs.existsSync(
      path.join(getGlobalConfigDir(), 'google-tokens.json'),
    );
    // Google OAuth 환경변수 확인 — 없으면 버튼 표시 불가
    const googleOAuthReady = Boolean(
      process.env.VIBE_SYNC_GOOGLE_CLIENT_ID && process.env.VIBE_SYNC_GOOGLE_CLIENT_SECRET,
    );

    // Telegram: inline keyboard button for Google Apps auth
    const telegram = this.interfaces.get('telegram');
    if (telegram) {
      await this.sendTelegramStartup(telegram, googleAppsOk, googleOAuthReady);
    }

    // Slack: Block Kit 버튼 (Google Apps 미연결 시)
    const slack = this.interfaces.get('slack');
    if (slack) {
      await this.sendSlackStartup(slack, googleAppsOk, googleOAuthReady);
    }
  }

  private async sendTelegramStartup(
    telegram: BaseInterface,
    googleAppsOk: boolean,
    googleOAuthReady: boolean,
  ): Promise<void> {
    const { TelegramBot } = await import('../interface/telegram/TelegramBot.js');
    if (!(telegram instanceof TelegramBot)) return;

    const chatIds = this.loadTelegramChatIds();

    // Google Apps 연결 완료 또는 OAuth 환경변수 미설정 → 텍스트만
    if (googleAppsOk || !googleOAuthReady) {
      const msg = googleAppsOk
        ? 'VIBE is ready.'
        : 'VIBE is ready.\n\nGoogle Apps: not configured (set VIBE_SYNC_GOOGLE_CLIENT_ID)';
      for (const chatId of chatIds) {
        try {
          await telegram.sendResponse({
            messageId: `startup-${Date.now()}`,
            channel: 'telegram',
            chatId,
            content: msg,
            format: 'text',
          });
        } catch { /* ignore */ }
      }
      return;
    }

    // OAuth 환경변수 있고, 토큰 없음 → 인라인 버튼으로 인증 유도
    for (const chatId of chatIds) {
      try {
        await telegram.sendInlineKeyboard(
          chatId,
          'VIBE is ready.\n\nGoogle Apps is not connected.',
          [[{ text: 'Connect Google Apps', callback_data: 'google_apps_auth' }]],
        );
      } catch (err) {
        this.logger('warn', `[telegram] Startup notification failed for ${chatId}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Register callback handler for the button
    telegram.onCallbackQuery(async (chatId: string, data: string, callbackQueryId: string) => {
      if (data !== 'google_apps_auth') return;

      await telegram.answerCallbackQuery(callbackQueryId, 'Starting Google Apps OAuth...');

      try {
        const { GoogleAuthManager } = await import('../router/services/GoogleAuthManager.js');
        const logger = (level: string, msg: string): void => {
          if (level === 'error') this.logger('warn', `[google-auth] ${msg}`);
        };
        const authManager = new GoogleAuthManager(logger as never);
        const authUrl = authManager.getAuthUrl();

        await telegram.sendResponse({
          messageId: `google-auth-${Date.now()}`,
          channel: 'telegram',
          chatId,
          content: `Open this link to authorize Google Apps:\n${authUrl}`,
          format: 'text',
        });

        const code = await authManager.startAuthFlow();
        await authManager.exchangeCode(code);

        await telegram.sendResponse({
          messageId: `google-auth-done-${Date.now()}`,
          channel: 'telegram',
          chatId,
          content: 'Google Apps connected! (Gmail, Drive, Sheets, Calendar, YouTube)',
          format: 'text',
        });
      } catch (err) {
        await telegram.sendResponse({
          messageId: `google-auth-fail-${Date.now()}`,
          channel: 'telegram',
          chatId,
          content: `Google Apps OAuth failed: ${err instanceof Error ? err.message : String(err)}`,
          format: 'text',
        });
      }
    });
  }

  private async sendSlackStartup(
    slack: BaseInterface,
    googleAppsOk: boolean,
    googleOAuthReady: boolean,
  ): Promise<void> {
    const { SlackBot } = await import('../interface/slack/SlackBot.js');
    if (!(slack instanceof SlackBot)) return;

    const channelIds = this.loadSlackChannelIds();

    if (googleAppsOk || !googleOAuthReady) {
      const msg = googleAppsOk
        ? 'VIBE is ready.'
        : 'VIBE is ready.\n\nGoogle Apps: not configured (set VIBE_SYNC_GOOGLE_CLIENT_ID)';
      for (const channelId of channelIds) {
        try {
          await slack.sendResponse({
            messageId: `startup-${Date.now()}`,
            channel: 'slack',
            chatId: channelId,
            content: msg,
            format: 'text',
          });
        } catch { /* ignore */ }
      }
      return;
    }

    // OAuth 환경변수 있고 토큰 없음 → Block Kit 버튼
    for (const channelId of channelIds) {
      try {
        await slack.sendBlockMessage(channelId, 'VIBE is ready.', [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ':white_check_mark: *VIBE is ready.*\n\n:warning: Google Apps is not connected.',
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Connect Google Apps' },
                action_id: 'google_apps_auth',
                style: 'primary',
              },
            ],
          },
        ]);
      } catch (err) {
        this.logger('warn', `[slack] Startup notification failed for ${channelId}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Block action 핸들러 등록
    slack.onBlockAction(async (channelId: string, actionId: string) => {
      if (actionId !== 'google_apps_auth') return;

      try {
        const { GoogleAuthManager } = await import('../router/services/GoogleAuthManager.js');
        const logger = (level: string, msg: string): void => {
          if (level === 'error') this.logger('warn', `[google-auth] ${msg}`);
        };
        const authManager = new GoogleAuthManager(logger as never);
        const authUrl = authManager.getAuthUrl();

        await slack.sendBlockMessage(channelId, 'Google Apps Authorization', [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ':link: Open this link to authorize Google Apps:',
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Authorize Google Account' },
                action_id: 'google_apps_open_link',
                url: authUrl,
              },
            ],
          },
        ]);

        const code = await authManager.startAuthFlow();
        await authManager.exchangeCode(code);

        await slack.sendResponse({
          messageId: `google-auth-done-${Date.now()}`,
          channel: 'slack',
          chatId: channelId,
          content: ':tada: Google Apps connected! (Gmail, Drive, Sheets, Calendar, YouTube)',
          format: 'text',
        });
      } catch (err) {
        await slack.sendResponse({
          messageId: `google-auth-fail-${Date.now()}`,
          channel: 'slack',
          chatId: channelId,
          content: `:x: Google Apps OAuth failed: ${err instanceof Error ? err.message : String(err)}`,
          format: 'text',
        });
      }
    });
  }

  private loadTelegramChatIds(): string[] {
    try {
      const ids = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',').filter(Boolean);
      if (ids.length > 0) return ids;
      if (fs.existsSync(TELEGRAM_CONFIG)) {
        const config = JSON.parse(fs.readFileSync(TELEGRAM_CONFIG, 'utf-8'));
        if (Array.isArray(config?.allowedChatIds)) return config.allowedChatIds;
      }
    } catch { /* ignore */ }
    return [];
  }

  private loadSlackChannelIds(): string[] {
    try {
      const ids = (process.env.SLACK_ALLOWED_CHANNELS || '').split(',').filter(Boolean);
      if (ids.length > 0) return ids;
      if (fs.existsSync(SLACK_CONFIG)) {
        const config = JSON.parse(fs.readFileSync(SLACK_CONFIG, 'utf-8'));
        if (Array.isArray(config?.allowedChannelIds)) return config.allowedChannelIds;
      }
    } catch { /* ignore */ }
    return [];
  }

  private loadState(): InterfaceState {
    try {
      if (!fs.existsSync(INTERFACE_CONFIG)) return {};
      return JSON.parse(fs.readFileSync(INTERFACE_CONFIG, 'utf-8')) as InterfaceState;
    } catch {
      return {};
    }
  }
}
