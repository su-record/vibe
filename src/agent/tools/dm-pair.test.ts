/**
 * DM Pair Tool Tests
 * Phase 3: Task 3.5
 */

import { describe, it, expect } from 'vitest';
import { dmPairTool, runInDmPairContext } from './dm-pair.js';
import type { ChannelType } from '../../interface/types.js';

describe('dm_pair tool', () => {
  it('should forward message when pair is allowed', async () => {
    const sent: Array<{ channel: ChannelType; chatId: string; text: string }> = [];

    const result = await runInDmPairContext(
      {
        sendToChannel: async (ch, cid, text) => {
          sent.push({ channel: ch, chatId: cid, text });
        },
        allowedPairs: [{ source: 'telegram', target: 'slack' }],
      },
      () => dmPairTool.handler({
        sourceChannel: 'telegram',
        targetChannel: 'slack',
        targetChatId: 'C123',
        message: 'Hello from TG',
      }),
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].channel).toBe('slack');
    expect(sent[0].chatId).toBe('C123');
    expect(sent[0].text).toBe('Hello from TG');
    expect(result).toContain('Success');
  });

  it('should reject disallowed pairs', async () => {
    const result = await runInDmPairContext(
      {
        sendToChannel: async () => {
          // Should not be called
        },
        allowedPairs: [{ source: 'telegram', target: 'slack' }],
      },
      () => dmPairTool.handler({
        sourceChannel: 'slack',
        targetChannel: 'telegram',
        targetChatId: 'chat1',
        message: 'test',
      }),
    );

    expect(result).toContain('not allowed');
    expect(result).toContain('slack → telegram');
  });

  it('should error without context', async () => {
    const result = await dmPairTool.handler({
      sourceChannel: 'telegram',
      targetChannel: 'slack',
      targetChatId: 'C1',
      message: 'test',
    });

    expect(result).toContain('context');
    expect(result).toContain('Error');
  });

  it('should handle sendToChannel errors gracefully', async () => {
    const result = await runInDmPairContext(
      {
        sendToChannel: async () => {
          throw new Error('Network timeout');
        },
        allowedPairs: [{ source: 'telegram', target: 'slack' }],
      },
      () => dmPairTool.handler({
        sourceChannel: 'telegram',
        targetChannel: 'slack',
        targetChatId: 'C999',
        message: 'test message',
      }),
    );

    expect(result).toContain('Error');
    expect(result).toContain('Network timeout');
  });

  it('should validate multiple allowed pairs correctly', async () => {
    const sent: Array<{ channel: ChannelType }> = [];

    const context = {
      sendToChannel: async (ch: ChannelType) => {
        sent.push({ channel: ch });
      },
      allowedPairs: [
        { source: 'telegram' as ChannelType, target: 'slack' as ChannelType },
        { source: 'slack' as ChannelType, target: 'imessage' as ChannelType },
        { source: 'web' as ChannelType, target: 'telegram' as ChannelType },
      ],
    };

    // Test allowed pair 1
    await runInDmPairContext(context, () =>
      dmPairTool.handler({
        sourceChannel: 'telegram',
        targetChannel: 'slack',
        targetChatId: 'C1',
        message: 'msg1',
      })
    );

    // Test allowed pair 2
    await runInDmPairContext(context, () =>
      dmPairTool.handler({
        sourceChannel: 'slack',
        targetChannel: 'imessage',
        targetChatId: '+1234',
        message: 'msg2',
      })
    );

    // Test disallowed pair
    const result = await runInDmPairContext(context, () =>
      dmPairTool.handler({
        sourceChannel: 'imessage',
        targetChannel: 'telegram',
        targetChatId: 'chat1',
        message: 'msg3',
      })
    );

    expect(sent).toHaveLength(2);
    expect(sent[0].channel).toBe('slack');
    expect(sent[1].channel).toBe('imessage');
    expect(result).toContain('not allowed');
  });
});
