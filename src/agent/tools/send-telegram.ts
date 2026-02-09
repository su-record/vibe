/**
 * send_telegram Tool - Telegram 메시지 전송
 * Phase 3: Function Calling Tool Definitions
 *
 * 보안: chatId는 파라미터로 받지 않고 AsyncLocalStorage로 요청 스코프에 바인딩
 * 동시성: AsyncLocalStorage로 동시 요청 간 chatId 격리 보장
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { ToolDefinition } from '../types.js';
import type { JsonSchema } from '../types.js';
import type { TelegramSendOptions } from '../../router/types.js';

const sendTelegramParameters: JsonSchema = {
  type: 'object',
  properties: {
    text: { type: 'string', description: 'Message text to send' },
    parseMode: { type: 'string', enum: ['HTML', 'Markdown'], description: 'Message parse mode' },
  },
  required: ['text'],
};

type SendFn = (chatId: string, text: string, options?: TelegramSendOptions) => Promise<void>;

// AsyncLocalStorage로 요청별 chatId 격리
const chatIdStore = new AsyncLocalStorage<string>();

// chatId별 sendFn 등록 (Map은 유지 — sendFn은 chatId별로 다를 수 있음)
const boundContexts = new Map<string, { sendFn: SendFn }>();

export function bindSendTelegram(
  chatId: string,
  sendFn: SendFn,
): void {
  boundContexts.set(chatId, { sendFn });
}

export function unbindSendTelegram(chatId: string): void {
  boundContexts.delete(chatId);
}

/**
 * 요청 스코프 내에서 chatId를 AsyncLocalStorage에 바인딩하고 콜백 실행
 * AgentLoop에서 메시지 처리 시 이 함수로 감싸서 호출
 */
export function runInChatContext<T>(chatId: string, fn: () => T): T {
  return chatIdStore.run(chatId, fn);
}

async function handleSendTelegram(args: Record<string, unknown>): Promise<string> {
  const { text, parseMode } = args as { text: string; parseMode?: 'HTML' | 'Markdown' };

  const chatId = chatIdStore.getStore();
  const ctx = chatId ? boundContexts.get(chatId) : undefined;

  if (!chatId || !ctx) {
    return 'Error: Telegram send function not bound to current chat context';
  }

  try {
    const format = parseMode === 'HTML' ? 'html' : parseMode === 'Markdown' ? 'markdown' : 'text';
    await ctx.sendFn(chatId, text, { format });
    return `Message sent to chat ${chatId}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Send failed: ${msg}`;
  }
}

export const sendTelegramTool: ToolDefinition = {
  name: 'send_telegram',
  description: 'Send a message to the current Telegram chat',
  parameters: sendTelegramParameters,
  handler: handleSendTelegram,
  scope: 'write',
};
