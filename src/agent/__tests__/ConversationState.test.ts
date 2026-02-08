/**
 * ConversationState 테스트
 * Phase 2: Scenarios 6, 7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConversationState } from '../ConversationState.js';

describe('ConversationState', () => {
  let state: ConversationState;

  beforeEach(() => {
    state = new ConversationState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Scenario 6: 대화 이력 관리
  describe('Scenario 6: Conversation history per chatId', () => {
    it('should manage messages per chatId', () => {
      state.addMessage('chat-1', { role: 'user', content: 'Hello' });
      state.addMessage('chat-1', { role: 'assistant', content: 'Hi' });
      state.addMessage('chat-2', { role: 'user', content: 'Bonjour' });

      const chat1 = state.getMessages('chat-1', 'gpt');
      const chat2 = state.getMessages('chat-2', 'gpt');

      expect(chat1).toHaveLength(2);
      expect(chat2).toHaveLength(1);
      expect(chat1[0].content).toBe('Hello');
      expect(chat2[0].content).toBe('Bonjour');
    });

    it('should enforce 20-message sliding window', () => {
      for (let i = 0; i < 25; i++) {
        state.addMessage('chat-1', { role: 'user', content: `msg-${i}` });
      }

      const messages = state.getMessages('chat-1', 'gpt');
      expect(messages.length).toBeLessThanOrEqual(20);
      // Should contain the most recent messages
      expect(messages[messages.length - 1].content).toBe('msg-24');
    });

    it('should return empty for unknown chatId', () => {
      expect(state.getMessages('unknown', 'gpt')).toEqual([]);
    });
  });

  // Scenario 7: 세션 타임아웃
  describe('Scenario 7: Session timeout', () => {
    it('should expire session after 30 minutes', () => {
      state.addMessage('chat-1', { role: 'user', content: 'Hello' });
      expect(state.isSessionExpired('chat-1')).toBe(false);

      // Advance 31 minutes
      vi.advanceTimersByTime(31 * 60 * 1000);

      expect(state.isSessionExpired('chat-1')).toBe(true);
      expect(state.getMessages('chat-1', 'gpt')).toEqual([]);
    });

    it('should reset and start fresh after expiry', () => {
      state.addMessage('chat-1', { role: 'user', content: 'old message' });

      vi.advanceTimersByTime(31 * 60 * 1000);

      state.addMessage('chat-1', { role: 'user', content: 'new message' });
      const messages = state.getMessages('chat-1', 'gpt');
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('new message');
    });

    it('should not expire within 30 minutes', () => {
      state.addMessage('chat-1', { role: 'user', content: 'Hello' });

      vi.advanceTimersByTime(29 * 60 * 1000);

      expect(state.isSessionExpired('chat-1')).toBe(false);
      expect(state.getMessages('chat-1', 'gpt')).toHaveLength(1);
    });
  });

  describe('Tool result compression', () => {
    it('should compress tool results larger than 4KB', () => {
      const largeResult = 'x'.repeat(8 * 1024); // 8KB
      state.addMessage('chat-1', {
        role: 'tool',
        content: largeResult,
        toolCallId: 'tc-1',
      });

      const messages = state.getMessages('chat-1', 'gpt');
      expect(messages[0].content.length).toBeLessThan(largeResult.length);
      expect(messages[0].content).toContain('결과 축약');
    });

    it('should not compress small tool results', () => {
      state.addMessage('chat-1', {
        role: 'tool',
        content: 'small result',
        toolCallId: 'tc-1',
      });

      const messages = state.getMessages('chat-1', 'gpt');
      expect(messages[0].content).toBe('small result');
    });
  });

  describe('Token estimation', () => {
    it('should estimate Korean text tokens', () => {
      const tokens = state.estimateStringTokens('안녕하세요');
      // 5 Korean chars × 0.5 = 2.5 → ceil = 3
      expect(tokens).toBe(3);
    });

    it('should estimate ASCII text tokens', () => {
      const tokens = state.estimateStringTokens('hello world');
      // 11 ASCII chars (including space) × 0.25 = 2.75 → ceil = 3
      expect(tokens).toBe(3);
    });
  });
});
