/**
 * Unit tests for SlackBot
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SlackConfig, InterfaceLogger } from '../../types.js';

describe('SlackBot', () => {
  const mockLogger: InterfaceLogger = vi.fn();
  const config: SlackConfig = {
    botToken: 'xoxb-test-token',
    appToken: 'xapp-test-token',
    allowedChannelIds: ['C12345', 'C67890'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('initializes with config', async () => {
      const { SlackBot } = await import('../SlackBot.js');
      const bot = new SlackBot(config, mockLogger);
      expect(bot.name).toBe('slack');
      expect(bot.channel).toBe('slack');
      expect(bot.getStatus()).toBe('disabled');
    });
  });

  describe('isAuthorized', () => {
    it('returns true for allowed channel', async () => {
      const { SlackBot } = await import('../SlackBot.js');
      const bot = new SlackBot(config, mockLogger);
      expect(bot.isAuthorized('C12345')).toBe(true);
    });

    it('returns false for unauthorized channel', async () => {
      const { SlackBot } = await import('../SlackBot.js');
      const bot = new SlackBot(config, mockLogger);
      expect(bot.isAuthorized('C99999')).toBe(false);
    });
  });
});
