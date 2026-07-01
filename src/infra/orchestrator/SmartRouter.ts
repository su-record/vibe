/**
 * SmartRouter - LLM 스마트 라우팅 및 fallback 관리
 */

import {
  TaskType,
  LLMProvider,
  SmartRouteRequest,
  SmartRouteResult,
  LLMAvailabilityCache,
  TASK_LLM_PRIORITY,
  TASK_SYSTEM_PROMPTS,
  getTaskLlmPriority
} from './types.js';
import * as gptApi from '../lib/gpt/index.js';
import * as antigravityApi from '../lib/antigravity/index.js';
import { LLMCluster } from './LLMCluster.js';
import { debugLog } from '../lib/utils.js';

/**
 * Claude 실행기 — SmartRouter 의 마지막 fallback(Claude)을 담당.
 * 기본 구현은 LLMCluster(claude CLI). 테스트에서는 mock 을 주입한다.
 */
export interface ClaudeRunner {
  claudeOrchestrate(prompt: string, systemPrompt?: string): Promise<string>;
}

// Claude CLI 는 로컬 spawn 이라 외부 API 보다 느릴 수 있어 더 긴 timeout 을 준다.
const CLAUDE_TIMEOUT_MS = 180_000;

// LLM 가용성 캐시 (5분 TTL)
// WHY 5min: Long enough to avoid hammering a down provider, short enough to
// recover quickly when a transient outage resolves (most LLM 503s clear in <3min).
const LLM_CACHE_TTL = 5 * 60 * 1000;

// 프로바이더별 timeout (30초)
// WHY 30s: LLM responses can legitimately take 10-20s for long prompts; 30s
// balances patience against blocking the fallback chain too long.
const PROVIDER_TIMEOUT_MS = 30_000;

/**
 * AllProvidersFailedError - 모든 LLM 프로바이더 실패 시 throw
 */
export class AllProvidersFailedError extends Error {
  public readonly attemptedProviders: LLMProvider[];
  public readonly errors: Record<string, string>;
  public readonly duration: number;

  constructor(
    attemptedProviders: LLMProvider[],
    errors: Record<string, string>,
    duration: number
  ) {
    const lastProvider = attemptedProviders[attemptedProviders.length - 1];
    const lastError = lastProvider ? errors[lastProvider] : 'No providers attempted';
    super(`All LLM providers failed. Last error (${lastProvider}): ${lastError}`);
    this.name = 'AllProvidersFailedError';
    this.attemptedProviders = attemptedProviders;
    this.errors = errors;
    this.duration = duration;
  }
}

/**
 * SmartRouter 설정
 */
export interface SmartRouterOptions {
  verbose?: boolean;
  /** Claude fallback 실행기 (기본: LLMCluster). 테스트 주입용. */
  claudeRunner?: ClaudeRunner;
}

/**
 * SmartRouter - Task 유형별 최적 LLM 선택 + fallback chain
 * GPT와 Antigravity를 지원
 */
export class SmartRouter {
  private cache: LLMAvailabilityCache;
  private verbose: boolean;
  private claudeRunner: ClaudeRunner;

  constructor(options: SmartRouterOptions = {}) {
    this.verbose = options.verbose ?? false;
    this.claudeRunner = options.claudeRunner ?? new LLMCluster();
    this.cache = {
      gpt: { available: true, checkedAt: 0, errorCount: 0 },
      antigravity: { available: true, checkedAt: 0, errorCount: 0 }
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
      systemPrompt = TASK_SYSTEM_PROMPTS.general,
      preferredLlm,
      maxRetries = 2
    } = request;

    // LLM 우선순위 결정
    const providers = this.getProviderPriority(type, preferredLlm);
    const attemptedProviders: LLMProvider[] = [];
    const errors: Record<string, string> = {};

    // WHY sequential fallback: Parallel calls waste tokens/quota on the slower
    // provider. Sequential tries the best-fit first, only falling back on failure.
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
          const content = await this.callLlmWithTimeout(provider, prompt, systemPrompt);
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

    // 모든 외부 LLM 실패 - AllProvidersFailedError throw
    throw new AllProvidersFailedError(
      attemptedProviders,
      errors,
      Date.now() - startTime
    );
  }

  /**
   * LLM 우선순위 결정
   * WHY task-based routing: GPT excels at code/reasoning tasks; Antigravity excels
   * at web search and multimodal (UI/UX). Routing by task type maximizes
   * quality while keeping Claude as the last-resort fallback (expensive).
   */
  private getProviderPriority(type: TaskType, preferredLlm?: LLMProvider): LLMProvider[] {
    const basePriority = getTaskLlmPriority(type);

    if (preferredLlm) {
      const others = basePriority.filter(p => p !== preferredLlm);
      return [preferredLlm, ...others];
    }

    return basePriority;
  }

  /**
   * LLM 호출 with timeout (프로바이더당 30초)
   */
  private async callLlmWithTimeout(
    provider: LLMProvider,
    prompt: string,
    systemPrompt: string
  ): Promise<string> {
    // Claude 는 로컬 CLI spawn 이라 외부 API 보다 더 긴 timeout 을 허용한다.
    const timeoutMs = provider === 'claude' ? CLAUDE_TIMEOUT_MS : PROVIDER_TIMEOUT_MS;
    // AbortController 로 timeout 시 진행 중인 fetch 를 실제로 취소한다.
    // (이전에는 Promise.race 만으로 로컬에서 빠져나올 뿐 원격 요청은 계속됐다 — B-3)
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error(`Provider ${provider} timeout (${timeoutMs / 1000}s)`);
        controller.abort(err);
        reject(err);
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([
        this.callLlm(provider, prompt, systemPrompt, controller.signal, timeoutMs),
        timeoutPromise
      ]);
      return result;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * LLM 호출
   */
  private async callLlm(
    provider: LLMProvider,
    prompt: string,
    systemPrompt: string,
    signal?: AbortSignal,
    timeoutMs?: number
  ): Promise<string> {
    switch (provider) {
      case 'gpt':
        return gptApi.coreGptOrchestrate(prompt, systemPrompt, { jsonMode: false, signal, timeoutMs });
      case 'antigravity':
        return antigravityApi.coreAntigravityOrchestrate(prompt, systemPrompt, { jsonMode: false, signal, timeoutMs });
      case 'claude':
        // 마지막 fallback — 로컬 claude CLI 실행 (LLMCluster 또는 주입된 runner).
        // 이전에는 'handled by caller' 예외만 던져 claude-only 환경/외부 LLM 장애 시
        // 항상 AllProvidersFailedError 로 끝났다. (execSync 라 signal abort 는 미적용)
        return this.claudeRunner.claudeOrchestrate(prompt, systemPrompt);
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

    // WHY 3 errors: A single timeout is often transient; 3 consecutive failures
    // strongly indicate the provider is genuinely down, so skip it until TTL expires.
    if (cache.errorCount >= 3) {
      cache.available = false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================
  // Convenience Methods (Smart* shortcuts)
  // ============================================

  async webSearch(query: string): Promise<SmartRouteResult> {
    return this.route({ type: 'web-search', prompt: query, systemPrompt: TASK_SYSTEM_PROMPTS['web-search'] });
  }

  async architectureReview(prompt: string): Promise<SmartRouteResult> {
    return this.route({ type: 'architecture', prompt, systemPrompt: TASK_SYSTEM_PROMPTS.architecture });
  }

  async uiuxReview(prompt: string): Promise<SmartRouteResult> {
    return this.route({ type: 'uiux', prompt, systemPrompt: TASK_SYSTEM_PROMPTS.uiux });
  }

  async codeAnalysis(prompt: string): Promise<SmartRouteResult> {
    return this.route({ type: 'code-analysis', prompt, systemPrompt: TASK_SYSTEM_PROMPTS['code-analysis'] });
  }

  async debugging(prompt: string): Promise<SmartRouteResult> {
    return this.route({ type: 'debugging', prompt, systemPrompt: TASK_SYSTEM_PROMPTS.debugging });
  }

  async codeGen(description: string, context?: string): Promise<SmartRouteResult> {
    const prompt = context ? `${description}\n\nContext:\n${context}` : description;
    return this.route({ type: 'code-gen', prompt, systemPrompt: TASK_SYSTEM_PROMPTS['code-gen'] });
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
      antigravity: { available: true, checkedAt: 0, errorCount: 0 }
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
