/**
 * Unit tests for IMessageFormatter
 */

import { describe, it, expect } from 'vitest';
import { IMessageFormatter } from '../IMessageFormatter.js';

describe('IMessageFormatter', () => {
  const formatter = new IMessageFormatter();

  describe('toPlainText', () => {
    it('removes bold markers (**)', () => {
      const input = '**bold text**';
      const expected = 'bold text';
      expect(formatter.toPlainText(input)).toBe(expected);
    });

    it('removes bold markers (__)', () => {
      const input = '__bold text__';
      const expected = 'bold text';
      expect(formatter.toPlainText(input)).toBe(expected);
    });

    it('removes italic markers (*)', () => {
      const input = '*italic text*';
      const expected = 'italic text';
      expect(formatter.toPlainText(input)).toBe(expected);
    });

    it('removes italic markers (_)', () => {
      const input = '_italic text_';
      const expected = 'italic text';
      expect(formatter.toPlainText(input)).toBe(expected);
    });

    it('removes strikethrough markers', () => {
      const input = '~~deleted~~';
      const expected = 'deleted';
      expect(formatter.toPlainText(input)).toBe(expected);
    });

    it('converts links to plain text with URL', () => {
      const input = '[Click here](https://example.com)';
      const expected = 'Click here (https://example.com)';
      expect(formatter.toPlainText(input)).toBe(expected);
    });

    it('removes code block markers', () => {
      const input = '```javascript\nconst x = 1;\n```';
      const expected = 'const x = 1;';
      expect(formatter.toPlainText(input)).toBe(expected);
    });

    it('removes inline code markers', () => {
      const input = 'Use `console.log()` for debugging';
      const expected = 'Use console.log() for debugging';
      expect(formatter.toPlainText(input)).toBe(expected);
    });

    it('removes header markers', () => {
      const input = '# Title\n## Subtitle';
      const expected = 'Title\nSubtitle';
      expect(formatter.toPlainText(input)).toBe(expected);
    });

    it('removes horizontal rules', () => {
      const input = 'Text\n---\nMore text';
      const expected = 'Text\n\nMore text';
      expect(formatter.toPlainText(input)).toBe(expected);
    });

    it('removes blockquote markers', () => {
      const input = '> This is a quote';
      const expected = 'This is a quote';
      expect(formatter.toPlainText(input)).toBe(expected);
    });

    it('handles empty string', () => {
      expect(formatter.toPlainText('')).toBe('');
    });

    it('handles mixed formatting', () => {
      const input = '**bold** and _italic_ with [link](http://test.com) and `code`';
      const expected = 'bold and italic with link (http://test.com) and code';
      expect(formatter.toPlainText(input)).toBe(expected);
    });

    it('cleans up excessive whitespace', () => {
      const input = 'Line 1\n\n\n\nLine 2';
      const expected = 'Line 1\n\nLine 2';
      expect(formatter.toPlainText(input)).toBe(expected);
    });
  });

  describe('splitMessage', () => {
    it('returns single chunk for short message', () => {
      const input = 'Short message';
      const result = formatter.splitMessage(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(input);
    });

    it('splits long message at 2000 chars', () => {
      const longText = 'a'.repeat(3000);
      const result = formatter.splitMessage(longText);
      expect(result.length).toBeGreaterThan(1);
      expect(result[0].length).toBeLessThanOrEqual(2000);
    });

    it('splits at paragraph boundary when possible', () => {
      const text = 'a'.repeat(1500) + '\n\n' + 'b'.repeat(1000);
      const result = formatter.splitMessage(text);
      expect(result.length).toBeGreaterThan(1);
      expect(result[0]).toContain('aaa');
      expect(result[1]).toContain('bbb');
    });

    it('splits at sentence boundary when no paragraphs', () => {
      const text = 'a'.repeat(1500) + '. ' + 'b'.repeat(1000);
      const result = formatter.splitMessage(text);
      expect(result.length).toBeGreaterThan(1);
    });

    it('handles empty string', () => {
      const result = formatter.splitMessage('');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('');
    });
  });
});
