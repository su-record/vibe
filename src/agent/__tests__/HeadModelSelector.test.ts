/**
 * HeadModelSelector 테스트
 * Phase 1: Scenarios 1, 2, 3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeadModelSelector, CircuitBreaker, isCircuitBreakerFailure } from '../HeadModelSelector.js';

// Mock GPT auth
vi.mock('../../lib/gpt/auth.js', () => ({
  getAuthInfo: vi.fn(),
}));

import { getAuthInfo } from '../../infra/lib/gpt/auth.js';
const mockGetAuthInfo = vi.mocked(getAuthInfo);

describe('HeadModelSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Scenario 1: GPT OAuth 인증 시 GPT-5.3-Codex 선택
  describe('Scenario 1: GPT OAuth → GPT-5.3-Codex', () => {
    it('should select GPT when OAuth is authenticated', async () => {
      mockGetAuthInfo.mockResolvedValue({
        type: 'oauth',
        accessToken: 'test-token',
      });

      const selector = new HeadModelSelector();
      const head = await selector.selectHead();

      expect(head.provider).toBe('gpt');
      expect(head.model).toBe('gpt-5.3-codex');
    });

    it('should select GPT when API key is configured', async () => {
      mockGetAuthInfo.mockResolvedValue({
        type: 'apikey',
        apiKey: 'sk-test',
      });

      const selector = new HeadModelSelector();
      const head = await selector.selectHead();

      expect(head.provider).toBe('gpt');
    });
  });

  // Scenario 2: GPT 미인증 시 Claude Opus fallback
  describe('Scenario 2: No GPT auth → Claude fallback', () => {
    it('should fallback to Claude when GPT auth fails', async () => {
      mockGetAuthInfo.mockRejectedValue(new Error('GPT credentials not found'));

      const selector = new HeadModelSelector();
      const head = await selector.selectHead();

      expect(head.provider).toBe('claude');
    });
  });

  // Scenario 3: GPT Circuit Breaker 동작
  describe('Scenario 3: Circuit Breaker', () => {
    it('should switch to Claude after 3 consecutive failures', async () => {
      mockGetAuthInfo.mockResolvedValue({
        type: 'apikey',
        apiKey: 'sk-test',
      });

      const selector = new HeadModelSelector();

      // 첫 번째 선택 → GPT
      const head1 = await selector.selectHead();
      expect(head1.provider).toBe('gpt');

      // 3회 연속 실패 보고
      const error = new Error('GPT API error (500): Internal Server Error');
      selector.reportFailure(head1, error);
      selector.reportFailure(head1, error);
      selector.reportFailure(head1, error);

      // Circuit breaker 열림 → Claude
      const head2 = await selector.selectHead();
      expect(head2.provider).toBe('claude');
    });

    it('should reset on success', async () => {
      mockGetAuthInfo.mockResolvedValue({
        type: 'apikey',
        apiKey: 'sk-test',
      });

      const selector = new HeadModelSelector();
      const head = await selector.selectHead();

      // 2회 실패 후 성공
      const error = new Error('GPT API error (500)');
      selector.reportFailure(head, error);
      selector.reportFailure(head, error);
      selector.reportSuccess(head);

      // 카운터 리셋 → GPT 유지
      const head2 = await selector.selectHead();
      expect(head2.provider).toBe('gpt');
    });
  });
});

describe('CircuitBreaker', () => {
  it('should start in closed state', () => {
    const cb = new CircuitBreaker();
    expect(cb.isAvailable()).toBe(true);
    expect(cb.getState().isOpen).toBe(false);
  });

  it('should open after threshold failures', () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isAvailable()).toBe(true);
    cb.recordFailure(); // threshold = 3
    expect(cb.isAvailable()).toBe(false);
    expect(cb.getState().isOpen).toBe(true);
  });

  it('should reset on success', () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    expect(cb.getState().failureCount).toBe(0);
    expect(cb.isAvailable()).toBe(true);
  });
});

describe('isCircuitBreakerFailure', () => {
  it('should detect HTTP 5xx', () => {
    expect(isCircuitBreakerFailure(new Error('GPT API error (500)'))).toBe(true);
    expect(isCircuitBreakerFailure(new Error('GPT API error (503)'))).toBe(true);
  });

  it('should detect timeout', () => {
    expect(isCircuitBreakerFailure(new Error('Request timeout'))).toBe(true);
    expect(isCircuitBreakerFailure(new Error('abort'))).toBe(true);
  });

  it('should detect network errors', () => {
    expect(isCircuitBreakerFailure(new Error('ECONNREFUSED'))).toBe(true);
    expect(isCircuitBreakerFailure(new Error('fetch failed'))).toBe(true);
  });

  it('should NOT detect client errors', () => {
    expect(isCircuitBreakerFailure(new Error('GPT API error (400)'))).toBe(false);
    expect(isCircuitBreakerFailure(new Error('Invalid arguments'))).toBe(false);
  });

  it('should handle non-Error values', () => {
    expect(isCircuitBreakerFailure('string error')).toBe(false);
    expect(isCircuitBreakerFailure(null)).toBe(false);
  });
});
