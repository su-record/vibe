/**
 * DM Pair Tool - Forward messages between allowed channel pairs
 * Phase 3: Task 3.5
 */

import type { ToolDefinition, JsonSchema } from '../types.js';
import type { ChannelType } from '../../interface/types.js';
import { AsyncLocalStorage } from 'node:async_hooks';

type ChannelSendFn = (channel: ChannelType, chatId: string, text: string) => Promise<void>;

interface DmPairContext {
  sendToChannel: ChannelSendFn;
  allowedPairs: Array<{ source: ChannelType; target: ChannelType }>;
}

const dmPairStore = new AsyncLocalStorage<DmPairContext>();

/** Bind DmPairContext for use in current async scope */
export function bindDmPair(context: DmPairContext): void {
  dmPairStore.enterWith(context);
}

/** Unbind DmPairContext from current scope */
export function unbindDmPair(): void {
  dmPairStore.disable();
}

/** Run function within a DmPairContext */
export function runInDmPairContext<T>(context: DmPairContext, fn: () => T): T {
  return dmPairStore.run(context, fn);
}

const parametersSchema: JsonSchema = {
  type: 'object',
  properties: {
    sourceChannel: {
      type: 'string',
      enum: ['telegram', 'slack', 'web'],
      description: 'Source channel',
    },
    targetChannel: {
      type: 'string',
      enum: ['telegram', 'slack', 'web'],
      description: 'Target channel',
    },
    targetChatId: {
      type: 'string',
      description: 'Target chat/channel ID',
    },
    message: {
      type: 'string',
      description: 'Message to forward',
    },
  },
  required: ['sourceChannel', 'targetChannel', 'targetChatId', 'message'],
};

async function dmPairHandler(args: Record<string, unknown>): Promise<string> {
  const context = dmPairStore.getStore();
  if (!context) {
    return 'Error: DM pair context not available. Tool must be run within DmPairContext.';
  }

  const { sourceChannel, targetChannel, targetChatId, message } = args as {
    sourceChannel: ChannelType;
    targetChannel: ChannelType;
    targetChatId: string;
    message: string;
  };

  // Validate that the channel pair is allowed
  const isPairAllowed = context.allowedPairs.some(
    (pair) => pair.source === sourceChannel && pair.target === targetChannel
  );

  if (!isPairAllowed) {
    return `Error: Channel pair not allowed: ${sourceChannel} → ${targetChannel}`;
  }

  try {
    await context.sendToChannel(targetChannel, targetChatId, message);
    return `Success: Message forwarded from ${sourceChannel} to ${targetChannel} (chat: ${targetChatId})`;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return `Error: Failed to send message: ${errorMsg}`;
  }
}

export const dmPairTool: ToolDefinition = {
  name: 'dm_pair',
  description: 'Forward a message from one channel to another (only allowed pairs)',
  parameters: parametersSchema,
  handler: dmPairHandler,
  scope: 'execute',
};
