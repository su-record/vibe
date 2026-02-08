/**
 * send_imessage Tool - iMessage 메시지 전송
 * Phase 3: Function Calling Tool Definitions
 *
 * 보안: handle은 파라미터로 받지 않고 AsyncLocalStorage로 요청 스코프에 바인딩
 * 동시성: AsyncLocalStorage로 동시 요청 간 handle 격리 보장
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';
import type { ToolRegistrationInput } from '../ToolRegistry.js';

export const sendIMessageSchema = z.object({
  message: z.string().describe('Message text to send'),
  handle: z.string().optional().describe('Override recipient handle (phone/email)'),
});

type SendFn = (handle: string, message: string) => Promise<void>;

// AsyncLocalStorage로 요청별 handle 격리
const handleStore = new AsyncLocalStorage<string>();

// handle별 sendFn 등록
const boundContexts = new Map<string, { sendFn: SendFn; allowedHandles: string[] }>();

export function bindSendIMessage(
  handle: string,
  sendFn: SendFn,
  allowedHandles: string[],
): void {
  boundContexts.set(handle, { sendFn, allowedHandles });
}

export function unbindSendIMessage(handle: string): void {
  boundContexts.delete(handle);
}

/**
 * 요청 스코프 내에서 handle을 AsyncLocalStorage에 바인딩하고 콜백 실행
 * AgentLoop에서 메시지 처리 시 이 함수로 감싸서 호출
 */
export function runInIMessageContext<T>(handle: string, fn: () => T): T {
  return handleStore.run(handle, fn);
}

async function handleSendIMessage(args: Record<string, unknown>): Promise<string> {
  // Platform check
  if (process.platform !== 'darwin') {
    return 'Error: iMessage only available on macOS';
  }

  const { message, handle: overrideHandle } = args as z.infer<typeof sendIMessageSchema>;

  const contextHandle = handleStore.getStore();
  const ctx = contextHandle ? boundContexts.get(contextHandle) : undefined;

  if (!contextHandle || !ctx) {
    return 'Error: iMessage send function not bound to current context';
  }

  // Determine target handle
  const targetHandle = overrideHandle || contextHandle;

  // Validate against allowlist
  if (!ctx.allowedHandles.includes(targetHandle)) {
    return `Error: Handle not authorized: ${targetHandle}`;
  }

  try {
    await ctx.sendFn(targetHandle, message);
    return `Message sent to ${targetHandle}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Send failed: ${msg}`;
  }
}

export const sendIMessageTool: ToolRegistrationInput = {
  name: 'send_imessage',
  description: 'Send a message to the current iMessage conversation',
  schema: sendIMessageSchema,
  handler: handleSendIMessage,
  scope: 'write',
};
