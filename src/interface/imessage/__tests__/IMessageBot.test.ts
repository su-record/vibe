/**
 * Unit tests for IMessageBot
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IMessageConfig, InterfaceLogger } from '../../types.js';

// Mock child_process.execFile for probe
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
    cb(new Error('not found'));
  }),
  spawn: vi.fn(),
}));

describe('IMessageBot', () => {
  const mockLogger: InterfaceLogger = vi.fn();
  const config: IMessageConfig = {
    allowedHandles: ['+1234567890', 'user@example.com'],
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

  describe('authorization', () => {
    it('allows all handles when allowedHandles is empty', async () => {
      const { IMessageBot } = await import('../IMessageBot.js');
      const emptyConfig: IMessageConfig = { allowedHandles: [] };
      const bot = new IMessageBot(emptyConfig, mockLogger);
      expect(bot['isAuthorizedHandle']('+9876543210')).toBe(true);
    });

    it('only allows listed handles', async () => {
      const { IMessageBot } = await import('../IMessageBot.js');
      const bot = new IMessageBot(config, mockLogger);
      expect(bot['isAuthorizedHandle']('+1234567890')).toBe(true);
      expect(bot['isAuthorizedHandle']('user@example.com')).toBe(true);
      expect(bot['isAuthorizedHandle']('+9876543210')).toBe(false);
    });
  });
});
