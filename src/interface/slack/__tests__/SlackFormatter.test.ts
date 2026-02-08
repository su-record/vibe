/**
 * Unit tests for SlackFormatter
 */

import { describe, it, expect } from 'vitest';
import { SlackFormatter } from '../SlackFormatter.js';

describe('SlackFormatter', () => {
  const formatter = new SlackFormatter();

  describe('toSlackMrkdwn', () => {
    it('converts bold markdown to Slack format', () => {
      const input = '**Hello World**';
      const expected = '*Hello World*';
      expect(formatter.toSlackMrkdwn(input)).toBe(expected);
    });

    it('converts strikethrough markdown to Slack format', () => {
      const input = '~~deprecated~~';
      const expected = '~deprecated~';
      expect(formatter.toSlackMrkdwn(input)).toBe(expected);
    });

    it('converts links to Slack format', () => {
      const input = '[Click here](https://example.com)';
      const expected = '<https://example.com|Click here>';
      expect(formatter.toSlackMrkdwn(input)).toBe(expected);
    });

    it('converts headers to bold text', () => {
      const input = '# Main Header\n## Sub Header';
      const expected = '*Main Header*\n*Sub Header*';
      expect(formatter.toSlackMrkdwn(input)).toBe(expected);
    });

    it('preserves code blocks', () => {
      const input = '```typescript\nconst x = 1;\n```';
      expect(formatter.toSlackMrkdwn(input)).toBe(input);
    });

    it('handles empty string', () => {
      expect(formatter.toSlackMrkdwn('')).toBe('');
    });

    it('handles mixed formatting', () => {
      const input = '**bold** and ~~strike~~ with [link](http://test.com)';
      const expected = '*bold* and ~strike~ with <http://test.com|link>';
      expect(formatter.toSlackMrkdwn(input)).toBe(expected);
    });
  });

  describe('splitMessage', () => {
    it('returns single chunk for short message', () => {
      const input = 'Short message';
      const result = formatter.splitMessage(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(input);
    });

    it('splits long message at 4000 chars', () => {
      const longText = 'a'.repeat(5000);
      const result = formatter.splitMessage(longText);
      expect(result.length).toBeGreaterThan(1);
      expect(result[0].length).toBeLessThanOrEqual(4000);
    });

    it('splits at paragraph boundary when possible', () => {
      const text = 'a'.repeat(3000) + '\n\n' + 'b'.repeat(2000);
      const result = formatter.splitMessage(text);
      expect(result.length).toBeGreaterThan(1);
      expect(result[0]).toContain('aaa');
      expect(result[1]).toContain('bbb');
    });

    it('handles empty string', () => {
      const result = formatter.splitMessage('');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('');
    });
  });

  describe('formatProgress', () => {
    it('formats job progress with bar', () => {
      const result = formatter.formatProgress('job-123', 'running', 50);
      expect(result).toContain('job-123');
      expect(result).toContain('running');
      expect(result).toContain('50%');
    });

    it('formats job status without progress bar', () => {
      const result = formatter.formatProgress('job-456', 'pending');
      expect(result).toContain('job-456');
      expect(result).toContain('pending');
      expect(result).not.toContain('%');
    });
  });

  describe('formatError', () => {
    it('formats error message with bold prefix', () => {
      const result = formatter.formatError('Something went wrong');
      expect(result).toBe('*Error:* Something went wrong');
    });

    it('handles empty error message', () => {
      const result = formatter.formatError('');
      expect(result).toBe('*Error:* ');
    });
  });
});
