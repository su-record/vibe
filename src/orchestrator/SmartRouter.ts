/**
 * SmartRouter - LLM 스마트 라우팅 및 fallback 관리
 * orchestrator.ts에서 추출된 라우팅 전용 모듈
 */

import {
  TaskType,
  LLMProvider,
  SmartRouteRequest,
  SmartRouteResult,
  LLMAvailabilityCache,
  TASK_LLM_PRIORITY
} from './types.js';
import * as gptApi from '../lib/gpt-api.js';
import * as geminiApi from '../lib/gemini-api.js';
import { debugLog } from '../lib/utils.js';

// LLM 가용성 캐시 (5분 TTL)
const LLM_CACHE_TTL = 5 * 60 * 1000;

/**
 * SmartRouter 설정
 */
export interface SmartRouterOptions {
  verbose?: boolean;
}

/**
 * SmartRouter - Task 유형별 최적 LLM 선택 + fallback chain
 */
export class SmartRouter {
  private cache: LLMAvailabilityCache;
  private verbose: boolean;

  constructor(options: SmartRouterOptions = {}) {
    this.verbose = options.verbose ?? false;
    this.cache = {
      gpt: { available: true, checkedAt: 0, errorCount: 0 },
      gemini: { available: true, checkedAt: 0, errorCount: 0 }
    };
  }

  /**
   * 스마트 라우팅 - 작업 유형에 따라 최적의 LLM 선택 + fallback
   */
  async route(request: SmartRouteRequest): Promise<SmartRouteResult> {
    const startTime = Date.now();
    const {
      type,
      prompt,
      systemPrompt = 'You are a helpful assistant.',
      preferredLlm,
      maxRetries = 2
    } = request;

    // LLM 우선순위 결정
    const providers = this.getProviderPriority(type, preferredLlm);
    const attemptedProviders: LLMProvider[] = [];
    const errors: Record<string, string> = {};

    // 각 LLM 순차 시도 (fallback chain)
    for (const provider of providers) {
      if (this.isUnavailable(provider)) {
        if (this.verbose) {
          debugLog(`[SmartRouter] Skipping ${provider} (recently failed)`);
        }
        continue;
      }

      attemptedProviders.push(provider);

      // 재시도 로직
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const content = await this.callLlm(provider, prompt, systemPrompt);
          this.markAvailable(provider);

          return {
            content,
            provider,
            success: true,
            usedFallback: attemptedProviders.length > 1,
            attemptedProviders,
            duration: Date.now() - startTime
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors[provider] = errorMsg;

          if (this.verbose) {
            debugLog(`[SmartRouter] ${provider} attempt ${attempt + 1} failed: ${errorMsg}`);
          }

          if (this.shouldSkipRetry(errorMsg)) {
            this.markUnavailable(provider);
            break;
          }

          if (attempt < maxRetries) {
            await this.delay(1000 * (attempt + 1));
          }
        }
      }

      this.markUnavailable(provider);
    }

    // 모든 외부 LLM 실패 - Claude fallback
    return {
      content: this.buildFallbackMessage(type, prompt, errors),
      provider: 'claude',
      success: true,
      usedFallback: true,
      attemptedProviders,
      errors: errors as Record<LLMProvider, string>,
      duration: Date.now() - startTime
    };
  }

  /**
   * LLM 우선순위 결정
   */
  private getProviderPriority(type: TaskType, preferredLlm?: LLMProvider): LLMProvider[] {
    if (preferredLlm) {
      const others = TASK_LLM_PRIORITY[type].filter(p => p !== preferredLlm);
      return [preferredLlm, ...others];
    }
    return [...TASK_LLM_PRIORITY[type]];
  }

  /**
   * LLM 호출
   */
  private async callLlm(
    provider: LLMProvider,
    prompt: string,
    systemPrompt: string
  ): Promise<string> {
    switch (provider) {
      case 'gpt':
        return gptApi.vibeGptOrchestrate(prompt, systemPrompt, { jsonMode: false });
      case 'gemini':
        return geminiApi.vibeGeminiOrchestrate(prompt, systemPrompt, { jsonMode: false });
      case 'claude':
        throw new Error('Claude fallback - handled by caller');
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * 재시도 없이 즉시 다음 LLM으로 넘어가야 하는 에러
   */
  private shouldSkipRetry(errorMsg: string): boolean {
    const skipPatterns = [
      'rate limit', 'quota', 'exhausted', '429', 'usage limit', 'too many requests',
      'no token', 'token not set', 'no api key', 'api key not set',
      'missing token', 'missing api key', 'not authenticated',
      'authentication failed', 'unauthorized', '401', 'auth'
    ];
    const lowerMsg = errorMsg.toLowerCase();
    return skipPatterns.some(pattern => lowerMsg.includes(pattern));
  }

  /**
   * LLM 가용성 확인 (캐시 기반)
   */
  private isUnavailable(provider: LLMProvider): boolean {
    if (provider === 'claude') return false;

    const cache = this.cache[provider];
    const now = Date.now();

    if (now - cache.checkedAt > LLM_CACHE_TTL) {
      cache.available = true;
      cache.errorCount = 0;
      return false;
    }

    return !cache.available || cache.errorCount >= 3;
  }

  /**
   * LLM 가용 상태로 마킹
   */
  private markAvailable(provider: LLMProvider): void {
    if (provider === 'claude') return;

    this.cache[provider] = {
      available: true,
      checkedAt: Date.now(),
      errorCount: 0
    };
  }

  /**
   * LLM 불가용 상태로 마킹
   */
  private markUnavailable(provider: LLMProvider): void {
    if (provider === 'claude') return;

    const cache = this.cache[provider];
    cache.errorCount++;
    cache.checkedAt = Date.now();

    if (cache.errorCount >= 3) {
      cache.available = false;
    }
  }

  /**
   * Fallback 메시지 생성
   */
  private buildFallbackMessage(
    type: TaskType,
    prompt: string,
    errors: Record<string, string>
  ): string {
    const errorSummary = Object.entries(errors)
      .map(([provider, msg]) => `- ${provider}: ${msg}`)
      .join('\n');

    return `[External LLM Unavailable - Claude Direct Handling]

All external LLMs failed. Claude should handle this ${type} task directly.

**Original Request:**
${prompt}

**Failed Providers:**
${errorSummary}

**Action Required:**
Claude, please handle this task using your own capabilities. Do NOT retry external LLMs.`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================
  // Convenience Methods (Smart* shortcuts)
  // ============================================

  async webSearch(query: string): Promise<SmartRouteResult> {
    return this.route({
      type: 'web-search',
      prompt: query,
      systemPrompt: 'Search the web and provide relevant information.'
    });
  }

  async architectureReview(prompt: string): Promise<SmartRouteResult> {
    return this.route({
      type: 'architecture',
      prompt,
      systemPrompt: 'You are a software architect. Analyze and review the architecture.'
    });
  }

  async uiuxReview(prompt: string): Promise<SmartRouteResult> {
    return this.route({
      type: 'uiux',
      prompt,
      systemPrompt: 'You are a UI/UX expert. Analyze and provide feedback.'
    });
  }

  async codeAnalysis(prompt: string): Promise<SmartRouteResult> {
    return this.route({
      type: 'code-analysis',
      prompt,
      systemPrompt: 'You are a code analysis expert. Review and analyze the code.'
    });
  }

  async debugging(prompt: string): Promise<SmartRouteResult> {
    return this.route({
      type: 'debugging',
      prompt,
      systemPrompt: 'You are a debugging expert. Find bugs and suggest fixes.'
    });
  }

  async codeGen(description: string, context?: string): Promise<SmartRouteResult> {
    const prompt = context ? `${description}\n\nContext:\n${context}` : description;
    return this.route({
      type: 'code-gen',
      prompt,
      systemPrompt: 'Generate clean, well-documented code.'
    });
  }

  /**
   * 캐시 상태 조회 (디버깅용)
   */
  getCacheStatus(): LLMAvailabilityCache {
    return { ...this.cache };
  }

  /**
   * 캐시 초기화
   */
  resetCache(): void {
    this.cache = {
      gpt: { available: true, checkedAt: 0, errorCount: 0 },
      gemini: { available: true, checkedAt: 0, errorCount: 0 }
    };
  }
}

// 싱글톤 인스턴스
let defaultRouter: SmartRouter | null = null;

export function getSmartRouter(options?: SmartRouterOptions): SmartRouter {
  if (!defaultRouter || options) {
    defaultRouter = new SmartRouter(options);
  }
  return defaultRouter;
}
