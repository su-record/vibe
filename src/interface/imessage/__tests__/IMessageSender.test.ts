/**
 * Unit tests for IMessageSender
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node modules
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event, cb) => {
      if (event === 'close') {
        setTimeout(() => cb(0), 0);
      }
    }),
  })),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));

describe('IMessageSender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle validation', () => {
    it('validates phone number format', async () => {
      const { IMessageSender } = await import('../IMessageSender.js');
      expect(IMessageSender['isValidHandle']('+1234567890')).toBe(true);
      expect(IMessageSender['isValidHandle']('+1 (234) 567-890')).toBe(true);
      expect(IMessageSender['isValidHandle']('123')).toBe(false);
    });

    it('validates email format', async () => {
      const { IMessageSender } = await import('../IMessageSender.js');
      expect(IMessageSender['isValidHandle']('user@example.com')).toBe(true);
      expect(IMessageSender['isValidHandle']('invalid@')).toBe(false);
    });

    it('rejects invalid handle on send', async () => {
      const { IMessageSender } = await import('../IMessageSender.js');
      await expect(IMessageSender.send('invalid', 'test')).rejects.toThrow('Invalid iMessage handle format');
    });
  });

  describe('platform checks', () => {
    it('accepts valid handles', async () => {
      const { IMessageSender } = await import('../IMessageSender.js');
      const validHandles = [
        '+1234567890',
        'user@example.com',
        '+1 (234) 567-8900',
      ];

      for (const handle of validHandles) {
        expect(IMessageSender['isValidHandle'](handle)).toBe(true);
      }
    });

    it('rejects invalid handles', async () => {
      const { IMessageSender } = await import('../IMessageSender.js');
      const invalidHandles = [
        'short',
        '@invalid',
        '123',
      ];

      for (const handle of invalidHandles) {
        expect(IMessageSender['isValidHandle'](handle)).toBe(false);
      }
    });
  });
});
