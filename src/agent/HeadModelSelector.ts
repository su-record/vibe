/**
 * HeadModelSelector - 헤드 모델 자동 선택
 * Phase 1: Head Model Selection & Tool Registry
 *
 * 우선순위:
 * 1. GPT OAuth 인증 있음 → GPT-5.3-Codex
 * 2. GPT 미인증 → Claude Opus 4.6 (fallback)
 *
 * Circuit breaker:
 * - 3회 연속 실패 시 대체 모델 전환 (5분 TTL)
 * - 실패 기준: HTTP 5xx, 네트워크 timeout (>10초), JSON 파싱 실패
 * - 성공 1회 시 카운터 리셋
 * - Half-open: TTL 만료 후 1회 시험 요청
 */

import { getAuthInfo } from '../core/lib/gpt/auth.js';
import { GptHeadModelProvider } from './providers/gpt-head.js';
import { ClaudeHeadModelProvider } from './providers/claude-head.js';
import type { CircuitBreakerState, HeadModelProvider } from './types.js';

const FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_TTL_MS = 5 * 60 * 1000; // 5분

// === Circuit Breaker ===

class CircuitBreaker {
  private state: CircuitBreakerState = {
    failureCount: 0,
    lastFailure: 0,
    isOpen: false,
    halfOpenAttempted: false,
  };

  recordFailure(): void {
    this.state.failureCount++;
    this.state.lastFailure = Date.now();

    if (this.state.failureCount >= FAILURE_THRESHOLD) {
      this.state.isOpen = true;
      this.state.halfOpenAttempted = false;
    }
  }

  recordSuccess(): void {
    this.state.failureCount = 0;
    this.state.isOpen = false;
    this.state.halfOpenAttempted = false;
  }

  isAvailable(): boolean {
    if (!this.state.isOpen) return true;

    const elapsed = Date.now() - this.state.lastFailure;
    if (elapsed >= CIRCUIT_OPEN_TTL_MS) {
      if (!this.state.halfOpenAttempted) {
        this.state.halfOpenAttempted = true;
        return true; // half-open: allow one trial
      }
    }

    return false;
  }

  getState(): Readonly<CircuitBreakerState> {
    return { ...this.state };
  }
}

// === HeadModelSelector ===

export class HeadModelSelector {
  private gptCircuitBreaker = new CircuitBreaker();
  private gptProvider = new GptHeadModelProvider();
  private claudeProvider = new ClaudeHeadModelProvider();

  async selectHead(): Promise<HeadModelProvider> {
    if (!this.gptCircuitBreaker.isAvailable()) {
      return this.claudeProvider;
    }

    const hasGptAuth = await this.checkGptAuth();
    return hasGptAuth ? this.gptProvider : this.claudeProvider;
  }

  reportSuccess(provider: HeadModelProvider): void {
    if (provider.provider === 'gpt') {
      this.gptCircuitBreaker.recordSuccess();
    }
  }

  reportFailure(provider: HeadModelProvider, error: unknown): void {
    if (provider.provider !== 'gpt') return;

    if (isCircuitBreakerFailure(error)) {
      this.gptCircuitBreaker.recordFailure();
    }
  }

  getCircuitBreakerState(): Readonly<CircuitBreakerState> {
    return this.gptCircuitBreaker.getState();
  }

  getClaudeProvider(): HeadModelProvider {
    return this.claudeProvider;
  }

  private async checkGptAuth(): Promise<boolean> {
    try {
      await getAuthInfo();
      return true;
    } catch {
      return false;
    }
  }
}

// === Failure Classification ===

function isCircuitBreakerFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const msg = error.message.toLowerCase();

  // HTTP 4xx (model not found, unauthorized, forbidden)
  if (/\b40[134]\b/.test(error.message)) return true;

  // HTTP 5xx
  if (/\b5\d{2}\b/.test(error.message)) return true;

  // Network timeout
  if (msg.includes('timeout') || msg.includes('timed out')) return true;
  if (msg.includes('abort')) return true;

  // JSON parse failure
  if (msg.includes('json') && msg.includes('parse')) return true;

  // Network errors
  if (msg.includes('econnrefused') || msg.includes('enotfound')) return true;
  if (msg.includes('fetch failed')) return true;

  return false;
}

export { CircuitBreaker, isCircuitBreakerFailure };
