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
  }

  async stopAll(): Promise<void> {
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

      try {
        const session = this.sessionPool.getOrCreateSession(process.cwd());
        const result = await this.sessionPool.sendRequest(session.id, message.content);
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

  private loadState(): InterfaceState {
    try {
      if (!fs.existsSync(INTERFACE_CONFIG)) return {};
      return JSON.parse(fs.readFileSync(INTERFACE_CONFIG, 'utf-8')) as InterfaceState;
    } catch {
      return {};
    }
  }
}
