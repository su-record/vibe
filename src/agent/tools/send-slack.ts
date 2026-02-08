/**
 * send_slack Tool - Slack message sending
 * Phase 3: Slack Channel
 *
 * Security: channelId is not exposed as a parameter, bound via AsyncLocalStorage
 * Concurrency: AsyncLocalStorage ensures channel isolation between concurrent requests
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';
import type { ToolRegistrationInput } from '../ToolRegistry.js';

export const sendSlackSchema = z.object({
  message: z.string().describe('Message text to send'),
  channel: z.string().optional().describe('Target channel ID (requires allowlist check)'),
  thread_ts: z.string().optional().describe('Thread timestamp for replies'),
});

type SendFn = (channelId: string, message: string, options?: { thread_ts?: string }) => Promise<void>;

interface BindContext {
  sendFn: SendFn;
  allowedChannelIds: string[];
}

// AsyncLocalStorage for per-request channel isolation
const channelIdStore = new AsyncLocalStorage<string>();

// channelId-specific sendFn registry (sendFn may differ per channel)
const boundContexts = new Map<string, BindContext>();

export function bindSendSlack(
  channelId: string,
  sendFn: SendFn,
  allowedChannelIds: string[],
): void {
  boundContexts.set(channelId, { sendFn, allowedChannelIds });
}

export function unbindSendSlack(channelId: string): void {
  boundContexts.delete(channelId);
}

/**
 * Run callback within a channelId-bound AsyncLocalStorage context.
 * AgentLoop should wrap message processing with this function.
 */
export function runInSlackContext<T>(channelId: string, fn: () => T): T {
  return channelIdStore.run(channelId, fn);
}

async function handleSendSlack(args: Record<string, unknown>): Promise<string> {
  const { message, channel, thread_ts } = args as z.infer<typeof sendSlackSchema>;

  const channelId = channelIdStore.getStore();
  const ctx = channelId ? boundContexts.get(channelId) : undefined;

  if (!channelId || !ctx) {
    return 'Error: Slack send function not bound to current channel context';
  }

  // If explicit channel provided, validate against allowlist
  const targetChannel = channel || channelId;
  if (channel && !ctx.allowedChannelIds.includes(channel)) {
    return `Error: Channel ${channel} is not in allowlist`;
  }

  try {
    await ctx.sendFn(targetChannel, message, { thread_ts });
    return `Message sent to channel ${targetChannel}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Send failed: ${msg}`;
  }
}

export const sendSlackTool: ToolRegistrationInput = {
  name: 'send_slack',
  description: 'Send a message to the current Slack channel',
  schema: sendSlackSchema,
  handler: handleSendSlack,
  scope: 'write',
};
