/**
 * send_slack Tool - Slack message sending
 * Phase 3: Slack Channel
 *
 * Security: channelId is not exposed as a parameter, bound via AsyncLocalStorage
 * Concurrency: AsyncLocalStorage ensures channel isolation between concurrent requests
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { ToolDefinition } from '../types.js';
import type { JsonSchema } from '../types.js';

const sendSlackParameters: JsonSchema = {
  type: 'object',
  properties: {
    message: { type: 'string', description: 'Message text to send' },
    channel: { type: 'string', description: 'Target channel ID (requires allowlist check)' },
    thread_ts: { type: 'string', description: 'Thread timestamp for replies' },
  },
  required: ['message'],
};

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
  const { message, channel, thread_ts } = args as { message: string; channel?: string; thread_ts?: string };

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

export const sendSlackTool: ToolDefinition = {
  name: 'send_slack',
  description: 'Send a message to the current Slack channel',
  parameters: sendSlackParameters,
  handler: handleSendSlack,
  scope: 'write',
};
