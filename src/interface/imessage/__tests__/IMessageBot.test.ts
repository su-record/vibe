/**
 * Unit tests for IMessageBot
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IMessageConfig, InterfaceLogger } from '../../types.js';

// Mock better-sqlite3 to prevent actual DB access
vi.mock('better-sqlite3', () => ({
  default: vi.fn(),
}));

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('not found')),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 100 }),
}));

// Mock IMessageSender
vi.mock('../IMessageSender.js', () => ({
  IMessageSender: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('IMessageBot', () => {
  const mockLogger: InterfaceLogger = vi.fn();
  const config: IMessageConfig = {
    allowedHandles: ['+1234567890', 'user@example.com'],
    pollingIntervalMs: 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('initializes with config', async () => {
      const { IMessageBot } = await import('../IMessageBot.js');
      const bot = new IMessageBot(config, mockLogger);
      expect(bot.name).toBe('imessage');
      expect(bot.channel).toBe('imessage');
      expect(bot.getStatus()).toBe('disabled');
    });
  });

  describe('handle validation', () => {
    it('validates phone number format', async () => {
      const { IMessageBot } = await import('../IMessageBot.js');
      const bot = new IMessageBot(config, mockLogger);
      // Access private method via bracket notation
      expect(bot['isValidHandle']('+1234567890')).toBe(true);
      expect(bot['isValidHandle']('+1 (234) 567-890')).toBe(true);
      expect(bot['isValidHandle']('123')).toBe(false);
    });

    it('validates email format', async () => {
      const { IMessageBot } = await import('../IMessageBot.js');
      const bot = new IMessageBot(config, mockLogger);
      expect(bot['isValidHandle']('user@example.com')).toBe(true);
      expect(bot['isValidHandle']('invalid-email')).toBe(false);
    });
  });
});
