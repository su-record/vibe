/**
 * TelegramQABridge - Permission request handling
 * Auto-approve read-only tools, manual approve via Telegram inline keyboard
 * 60-second timeout with configurable behavior
 */

import { PermissionRequest, InterfaceLogger } from '../../interface/types.js';
import { QAConfig, InlineKeyboardButton, RouteServices } from '../types.js';

const DESTRUCTIVE_BLACKLIST: ReadonlySet<string> = new Set([
  'rm -rf', 'push --force', 'reset --hard', 'clean -f',
  'branch -D', 'checkout .', 'restore .',
]);

interface PendingPermission {
  request: PermissionRequest;
  resolve: (approved: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
  telegramMessageId?: number;
}

export class TelegramQABridge {
  private logger: InterfaceLogger;
  private config: QAConfig;
  private pendingQueue: PendingPermission[] = [];
  private services: RouteServices | null = null;
  private chatId: string;
  private processing: boolean = false;

  constructor(
    logger: InterfaceLogger,
    config: QAConfig,
    chatId: string,
  ) {
    this.logger = logger;
    this.config = config;
    this.chatId = chatId;
  }

  /** Set services (deferred) */
  setServices(services: RouteServices): void {
    this.services = services;
  }

  /** Handle a permission request from ClaudeCodeBridge */
  async handlePermissionRequest(request: PermissionRequest): Promise<boolean> {
    // Auto-approve read-only tools
    if (this.isAutoApproved(request.tool)) {
      this.logger('debug', `Auto-approved: ${request.tool}`);
      return true;
    }

    // Queue and process sequentially
    return new Promise((resolve) => {
      const pending: PendingPermission = {
        request,
        resolve,
        timer: setTimeout(() => {
          this.handleTimeout(pending);
        }, this.config.maxWaitSeconds * 1000),
      };

      this.pendingQueue.push(pending);
      this.processNext();
    });
  }

  /** Handle callback from Telegram inline keyboard */
  handleCallbackResponse(callbackData: string): void {
    if (this.pendingQueue.length === 0) return;

    const pending = this.pendingQueue[0];
    clearTimeout(pending.timer);
    this.pendingQueue.shift();

    const approved = callbackData === 'approve';
    this.logger('info', `Permission ${approved ? 'approved' : 'denied'}: ${pending.request.tool}`);
    pending.resolve(approved);

    this.processing = false;
    this.processNext();
  }

  /** Cleanup all pending requests */
  cleanup(): void {
    for (const pending of this.pendingQueue) {
      clearTimeout(pending.timer);
      pending.resolve(false);
    }
    this.pendingQueue = [];
    this.processing = false;
  }

  /** Check if tool is in auto-approve list */
  private isAutoApproved(tool: string): boolean {
    return this.config.autoApproveTools.includes(tool);
  }

  /** Process next pending permission request */
  private async processNext(): Promise<void> {
    if (this.processing || this.pendingQueue.length === 0) return;
    if (!this.services) return;

    this.processing = true;
    const pending = this.pendingQueue[0];

    const text = `🔐 권한 요청\n\n도구: ${pending.request.tool}\n설명: ${pending.request.description}\n\n승인하시겠습니까?`;

    const buttons: InlineKeyboardButton[][] = [[
      { text: '✅ 승인', callback_data: 'approve' },
      { text: '❌ 거부', callback_data: 'deny' },
    ]];

    try {
      const msgId = await this.services.sendTelegramInlineKeyboard(
        this.chatId,
        text,
        buttons,
      );
      pending.telegramMessageId = msgId;
    } catch (err) {
      this.logger('error', 'Failed to send permission keyboard', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Handle timeout based on tool type */
  private handleTimeout(pending: PendingPermission): void {
    const idx = this.pendingQueue.indexOf(pending);
    if (idx === -1) return;

    this.pendingQueue.splice(idx, 1);

    const isReadOnly = this.isAutoApproved(pending.request.tool);
    if (isReadOnly) {
      pending.resolve(true);
      this.notifyAutoProgress('읽기 전용 도구 - 자동 승인됨');
    } else if (this.shouldAutoDecideOnTimeout(pending.request)) {
      pending.resolve(true);
      this.notifyAutoProgress('AI 판단으로 자동 진행됨');
    } else {
      pending.resolve(false);
      this.notifyAutoProgress('타임아웃 - 자동 거부됨');
    }

    this.processing = false;
    this.processNext();
  }

  /** Check if we should auto-decide on timeout */
  private shouldAutoDecideOnTimeout(request: PermissionRequest): boolean {
    if (this.config.writeOnTimeout !== 'ai_decide') return false;
    return !this.isDestructiveCommand(request.description);
  }

  /** Check if a command description contains destructive patterns */
  private isDestructiveCommand(description: string): boolean {
    const lower = description.toLowerCase();
    for (const pattern of DESTRUCTIVE_BLACKLIST) {
      if (lower.includes(pattern)) return true;
    }
    return false;
  }

  /** Send auto-progress notification */
  private notifyAutoProgress(reason: string): void {
    if (!this.services) return;
    this.services.sendTelegram(this.chatId, `⏱️ ${reason}`).catch(() => {});
  }
}
