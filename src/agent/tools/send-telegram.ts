/**
 * send_telegram Tool - Telegram 메시지 전송
 * Phase 3: Function Calling Tool Definitions
 *
 * 보안: chatId는 파라미터로 받지 않고 현재 요청의 chatId에 바인딩
 */

import { z } from 'zod';
import type { ToolRegistrationInput } from '../ToolRegistry.js';
import type { TelegramSendOptions } from '../../router/types.js';

export const sendTelegramSchema = z.object({
  text: z.string().describe('Message text to send'),
  parseMode: z.enum(['HTML', 'Markdown']).optional().describe('Message parse mode'),
});

// chatId는 런타임에 바인딩됨 (AgentLoop에서 주입)
let boundChatId: string | null = null;
let boundSendFn: ((chatId: string, text: string, options?: TelegramSendOptions) => Promise<void>) | null = null;

export function bindSendTelegram(
  chatId: string,
  sendFn: (chatId: string, text: string, options?: TelegramSendOptions) => Promise<void>,
): void {
  boundChatId = chatId;
  boundSendFn = sendFn;
}

export function unbindSendTelegram(): void {
  boundChatId = null;
  boundSendFn = null;
}

async function handleSendTelegram(args: Record<string, unknown>): Promise<string> {
  const { text, parseMode } = args as z.infer<typeof sendTelegramSchema>;

  if (!boundChatId || !boundSendFn) {
    return 'Error: Telegram send function not bound to current chat context';
  }

  try {
    const format = parseMode === 'HTML' ? 'html' : parseMode === 'Markdown' ? 'markdown' : 'text';
    await boundSendFn(boundChatId, text, { format });
    return `Message sent to chat ${boundChatId}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Send failed: ${msg}`;
  }
}

export const sendTelegramTool: ToolRegistrationInput = {
  name: 'send_telegram',
  description: 'Send a message to the current Telegram chat',
  schema: sendTelegramSchema,
  handler: handleSendTelegram,
  scope: 'write',
};
