/**
 * Orchestrator - 메인 오케스트레이터 클래스
 * /vibe.* 명령어에서 사용할 중앙 오케스트레이션 로직
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  OrchestratorOptions,
  AgentConfig,
  AgentResult,
  BackgroundAgentArgs,
  BackgroundAgentHandle,
  ParallelResearchArgs,
  ParallelResearchResult,
  DiscoveredAgent,
  TaskType,
  LLMProvider,
  SmartRouteRequest,
  SmartRouteResult,
  LLMAvailabilityCache,
  TASK_LLM_PRIORITY
} from './types.js';
import { ToolResult } from '../types/tool.js';
import { discoverAgents, loadAgent, listAgentsByCategory } from './agentDiscovery.js';
import { debugLog, errorLog, warnLog } from '../lib/utils.js';
import { DEFAULT_MODELS } from '../lib/constants.js';
import {
  parallelResearch,
  researchFeature,
  createResearchTasks
} from './parallelResearch.js';
import {
  launchBackgroundAgent,
  getBackgroundAgentResult,
  cancelBackgroundAgent,
  listActiveSessions,
  getSessionHistory,
  launchParallelAgents
} from './backgroundAgent.js';
import { MemoryManager } from '../lib/MemoryManager.js';
import * as gptApi from '../lib/gpt-api.js';
import * as geminiApi from '../lib/gemini-api.js';

// LLM 가용성 캐시 (5분 TTL)
const LLM_CACHE_TTL = 5 * 60 * 1000;
const llmAvailabilityCache: LLMAvailabilityCache = {
  gpt: { available: true, checkedAt: 0, errorCount: 0 },
  gemini: { available: true, checkedAt: 0, errorCount: 0 }
};

/**
 * Vibe Orchestrator
 * 모든 /vibe.* 명령어의 오케스트레이션을 담당
 */
export class VibeOrchestrator {
  private options: OrchestratorOptions;
  private memoryManager: MemoryManager;

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      projectPath: process.cwd(),
      verbose: false,
      saveResults: true,
      resultsPath: '.claude/vibe/orchestrator',
      ...options
    };
    this.memoryManager = MemoryManager.getInstance(this.options.projectPath);
  }

  // ============================================
  // Smart Routing (핵심 오케스트레이션)
  // ============================================

  /**
   * 스마트 라우팅 - 작업 유형에 따라 최적의 LLM 선택 + fallback
   *
   * @example
   * const result = await orchestrator.smartRoute({
   *   type: 'architecture',
   *   prompt: 'Review this system design'
   * });
   */
  async smartRoute(request: SmartRouteRequest): Promise<SmartRouteResult> {
    const startTime = Date.now();
    const {
      type,
      prompt,
      systemPrompt = 'You are a helpful assistant.',
      preferredLlm,
      maxRetries = 2
    } = request;

    // LLM 우선순위 결정
    let providers: LLMProvider[];
    if (preferredLlm) {
      // 지정된 LLM 우선, 나머지는 fallback
      const others = TASK_LLM_PRIORITY[type].filter(p => p !== preferredLlm);
      providers = [preferredLlm, ...others];
    } else {
      providers = [...TASK_LLM_PRIORITY[type]];
    }

    const attemptedProviders: LLMProvider[] = [];
    const errors: Record<string, string> = {};

    // 각 LLM 순차 시도 (fallback chain)
    for (const provider of providers) {
      // 캐시 확인 - 최근 실패한 LLM 건너뛰기
      if (this.isLlmUnavailable(provider)) {
        if (this.options.verbose) {
          debugLog(`[SmartRoute] Skipping ${provider} (recently failed)`);
        }
        continue;
      }

      attemptedProviders.push(provider);

      // 재시도 로직
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const content = await this.callLlm(provider, prompt, systemPrompt);

          // 성공 - 캐시 업데이트
          this.markLlmAvailable(provider);

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

          if (this.options.verbose) {
            debugLog(`[SmartRoute] ${provider} attempt ${attempt + 1} failed: ${errorMsg}`);
          }

          // Rate limit, quota, 인증 에러는 바로 다음 LLM으로 (재시도 의미 없음)
          if (this.shouldSkipRetry(errorMsg)) {
            this.markLlmUnavailable(provider);
            break;
          }

          // 마지막 재시도가 아니면 잠시 대기
          if (attempt < maxRetries) {
            await this.delay(1000 * (attempt + 1));
          }
        }
      }

      // 해당 LLM 실패 - 다음으로
      this.markLlmUnavailable(provider);
    }

    // 모든 외부 LLM 실패 - Claude fallback 메시지 반환
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
   * LLM 호출 (provider별 분기)
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
        // Claude는 직접 처리하지 않고 fallback 메시지 반환
        throw new Error('Claude fallback - handled by caller');
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * 재시도 없이 즉시 다음 LLM으로 넘어가야 하는 에러인지 확인
   * - Rate limit/Quota 에러
   * - 인증 에러 (토큰/키 없음)
   */
  private shouldSkipRetry(errorMsg: string): boolean {
    const skipPatterns = [
      // Rate limit / Quota
      'rate limit',
      'quota',
      'exhausted',
      '429',
      'usage limit',
      'too many requests',
      // 인증 에러 (토큰/키 없음) - 재시도 의미 없음
      '토큰이 없습니다',
      '토큰이 설정되지',
      'api 키가 없습니다',
      'api 키가 설정되지',
      'no token',
      'no api key',
      'missing token',
      'missing api key',
      'not authenticated',
      'authentication failed',
      'unauthorized',
      '401',
      '인증'
    ];
    const lowerMsg = errorMsg.toLowerCase();
    return skipPatterns.some(pattern => lowerMsg.includes(pattern));
  }

  /**
   * LLM 가용성 확인 (캐시 기반)
   */
  private isLlmUnavailable(provider: LLMProvider): boolean {
    if (provider === 'claude') return false;

    const cache = llmAvailabilityCache[provider];
    const now = Date.now();

    // 캐시 만료 확인
    if (now - cache.checkedAt > LLM_CACHE_TTL) {
      cache.available = true;
      cache.errorCount = 0;
      return false;
    }

    // 연속 3회 이상 실패 시 unavailable
    return !cache.available || cache.errorCount >= 3;
  }

  /**
   * LLM 가용 상태로 마킹
   */
  private markLlmAvailable(provider: LLMProvider): void {
    if (provider === 'claude') return;

    llmAvailabilityCache[provider] = {
      available: true,
      checkedAt: Date.now(),
      errorCount: 0
    };
  }

  /**
   * LLM 불가용 상태로 마킹
   */
  private markLlmUnavailable(provider: LLMProvider): void {
    if (provider === 'claude') return;

    const cache = llmAvailabilityCache[provider];
    cache.errorCount++;
    cache.checkedAt = Date.now();

    if (cache.errorCount >= 3) {
      cache.available = false;
    }
  }

  /**
   * Fallback 메시지 생성 (Claude가 직접 처리하도록 안내)
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

  /**
   * 지연 유틸리티
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 웹 검색 with fallback (GPT → Gemini → Claude WebSearch)
   */
  async smartWebSearch(query: string): Promise<SmartRouteResult> {
    return this.smartRoute({
      type: 'web-search',
      prompt: query,
      systemPrompt: 'Search the web and provide relevant information.'
    });
  }

  /**
   * 아키텍처 분석 with fallback
   */
  async smartArchitectureReview(prompt: string): Promise<SmartRouteResult> {
    return this.smartRoute({
      type: 'architecture',
      prompt,
      systemPrompt: 'You are a software architect. Analyze and review the architecture.'
    });
  }

  /**
   * UI/UX 분석 with fallback
   */
  async smartUiuxReview(prompt: string): Promise<SmartRouteResult> {
    return this.smartRoute({
      type: 'uiux',
      prompt,
      systemPrompt: 'You are a UI/UX expert. Analyze and provide feedback.'
    });
  }

  /**
   * 코드 분석 with fallback
   */
  async smartCodeAnalysis(prompt: string): Promise<SmartRouteResult> {
    return this.smartRoute({
      type: 'code-analysis',
      prompt,
      systemPrompt: 'You are a code analysis expert. Review and analyze the code.'
    });
  }

  /**
   * 디버깅 with fallback
   */
  async smartDebugging(prompt: string): Promise<SmartRouteResult> {
    return this.smartRoute({
      type: 'debugging',
      prompt,
      systemPrompt: 'You are a debugging expert. Find bugs and suggest fixes.'
    });
  }

  /**
   * 코드 생성 with fallback (Claude 직접)
   */
  async smartCodeGen(description: string, context?: string): Promise<SmartRouteResult> {
    const prompt = context
      ? `${description}\n\nContext:\n${context}`
      : description;

    return this.smartRoute({
      type: 'code-gen',
      prompt,
      systemPrompt: 'Generate clean, well-documented code.'
    });
  }

  /**
   * 에이전트 탐색
   */
  async discoverAgents(category?: string): Promise<DiscoveredAgent[]> {
    const result = await discoverAgents({
      projectPath: this.options.projectPath,
      category
    });

    if ('agents' in result) {
      return (result as ToolResult & { agents: DiscoveredAgent[] }).agents;
    }
    return [];
  }

  /**
   * 특정 에이전트 로드
   */
  async loadAgent(agentName: string): Promise<DiscoveredAgent | null> {
    return loadAgent(agentName, this.options.projectPath);
  }

  /**
   * 병렬 리서치 실행
   */
  async runParallelResearch(args: ParallelResearchArgs): Promise<ParallelResearchResult> {
    const result = await parallelResearch({
      ...args,
      projectPath: args.projectPath || this.options.projectPath
    });

    // 결과 저장
    if (this.options.saveResults && 'results' in result) {
      await this.saveOrchestratorResult('research', result);
    }

    if ('results' in result) {
      return result as unknown as ParallelResearchResult;
    }

    return {
      results: [],
      totalDuration: 0,
      successCount: 0,
      failureCount: 0
    };
  }

  /**
   * 기능 기반 리서치 (간편 API)
   */
  async researchFeature(feature: string, techStack: string[] = []): Promise<ParallelResearchResult> {
    const tasks = createResearchTasks(feature, techStack);
    return this.runParallelResearch({ tasks });
  }

  /**
   * 백그라운드 에이전트 시작
   */
  async launchAgent(args: BackgroundAgentArgs): Promise<BackgroundAgentHandle | null> {
    const result = await launchBackgroundAgent({
      ...args,
      projectPath: args.projectPath || this.options.projectPath
    });

    if ('handle' in result) {
      return (result as ToolResult & { handle: BackgroundAgentHandle }).handle;
    }
    return null;
  }

  /**
   * 여러 에이전트 동시 실행
   */
  async launchAgents(configs: BackgroundAgentArgs[]): Promise<BackgroundAgentHandle[]> {
    const result = await launchParallelAgents(
      configs.map(c => ({
        ...c,
        projectPath: c.projectPath || this.options.projectPath
      }))
    );

    if ('handles' in result) {
      return (result as ToolResult & { handles: BackgroundAgentHandle[] }).handles;
    }
    return [];
  }

  /**
   * 에이전트 결과 조회
   */
  async getAgentResult(sessionId: string): Promise<AgentResult | null> {
    const result = await getBackgroundAgentResult(sessionId);

    if ('result' in result) {
      return (result as ToolResult & { result: AgentResult }).result;
    }
    return null;
  }

  /**
   * 에이전트 취소
   */
  cancelAgent(sessionId: string): boolean {
    const result = cancelBackgroundAgent(sessionId);
    return result.content[0].text.includes('cancelled');
  }

  /**
   * 활성 세션 목록
   */
  getActiveSessions(): ToolResult {
    return listActiveSessions();
  }

  /**
   * 세션 히스토리
   */
  getHistory(limit: number = 10): ToolResult {
    return getSessionHistory(limit);
  }

  /**
   * 리뷰 에이전트 병렬 실행
   * /vibe.review에서 사용
   */
  async runParallelReview(filePaths: string[], techStack: string[] = []): Promise<AgentResult[]> {
    // 리뷰 에이전트 탐색
    const reviewAgents = await listAgentsByCategory('review', this.options.projectPath);

    // 기술 스택에 맞는 에이전트만 필터링
    const relevantAgents = this.filterRelevantAgents(reviewAgents, techStack);

    // 각 에이전트에 대한 프롬프트 생성
    const agentConfigs: BackgroundAgentArgs[] = relevantAgents.map(agent => ({
      agentName: agent.name,
      prompt: this.buildReviewPrompt(agent, filePaths),
      model: DEFAULT_MODELS.REVIEW,
      maxTurns: 3,
      allowedTools: ['Read', 'Glob', 'Grep']
    }));

    // 병렬 실행
    const handles = await this.launchAgents(agentConfigs);

    // 모든 결과 수집
    const results: AgentResult[] = [];
    for (const handle of handles) {
      const result = await handle.getResult();
      results.push(result);
    }

    // 결과 저장
    if (this.options.saveResults) {
      await this.saveOrchestratorResult('review', { results, filePaths, techStack });
    }

    return results;
  }

  /**
   * 기술 스택에 맞는 에이전트 필터링
   */
  private filterRelevantAgents(agents: DiscoveredAgent[], techStack: string[]): DiscoveredAgent[] {
    // 항상 실행할 코어 리뷰어
    const coreReviewers = [
      'security-reviewer',
      'performance-reviewer',
      'architecture-reviewer',
      'complexity-reviewer',
      'simplicity-reviewer',
      'data-integrity-reviewer',
      'test-coverage-reviewer',
      'git-history-reviewer'
    ];

    // 스택별 리뷰어 매핑
    const stackReviewers: Record<string, string[]> = {
      typescript: ['typescript-reviewer'],
      python: ['python-reviewer'],
      react: ['react-reviewer'],
      rails: ['rails-reviewer'],
      ruby: ['rails-reviewer']
    };

    const relevantNames = new Set(coreReviewers);

    // 기술 스택에 맞는 리뷰어 추가
    for (const tech of techStack) {
      const reviewers = stackReviewers[tech.toLowerCase()];
      if (reviewers) {
        reviewers.forEach(r => relevantNames.add(r));
      }
    }

    return agents.filter(agent => {
      const normalizedName = agent.name.toLowerCase().replace(/\s+/g, '-');
      return relevantNames.has(normalizedName) ||
        Array.from(relevantNames).some(r => normalizedName.includes(r));
    });
  }

  /**
   * 리뷰 프롬프트 생성
   */
  private buildReviewPrompt(agent: DiscoveredAgent, filePaths: string[]): string {
    return `You are a ${agent.name}. Review the following files for issues in your domain:

Files to review:
${filePaths.map(f => `- ${f}`).join('\n')}

${agent.content}

Provide findings in this format:
- Priority: P1 (Critical), P2 (Important), P3 (Nice-to-have)
- Category: Your specialty area
- Location: file:line
- Issue: Description
- Fix: Recommendation`;
  }

  /**
   * 결과 저장
   */
  private async saveOrchestratorResult(type: string, data: unknown): Promise<void> {
    const resultsDir = path.join(
      this.options.projectPath!,
      this.options.resultsPath!
    );

    try {
      await fs.mkdir(resultsDir, { recursive: true });

      const filename = `${type}-${Date.now()}.json`;
      const filepath = path.join(resultsDir, filename);

      await fs.writeFile(filepath, JSON.stringify(data, null, 2));

      if (this.options.verbose) {
        debugLog(`Saved orchestrator result: ${filepath}`);
      }
    } catch (error) {
      errorLog('Failed to save orchestrator result:', error);
    }
  }

  /**
   * 메모리에 결과 저장
   */
  saveToMemory(key: string, value: string, category: string = 'orchestrator'): void {
    this.memoryManager.save(key, value, category);
  }

  /**
   * 메모리에서 결과 조회
   */
  getFromMemory(key: string): string | null {
    const memory = this.memoryManager.recall(key);
    return memory?.value || null;
  }

  // ============================================
  // GPT Integration (웹 검색, 아키텍처 분석)
  // ============================================

  /**
   * GPT 웹 검색 (Gemini로 위임)
   * @param query 검색 쿼리
   * @deprecated GPT Codex API는 웹 검색을 지원하지 않습니다. geminiWebSearch를 사용하세요.
   */
  async gptWebSearch(query: string): Promise<string> {
    // GPT Codex API는 웹 검색 미지원 → Gemini로 위임
    return this.geminiWebSearch(query);
  }

  /**
   * GPT 오케스트레이션
   * @param prompt 프롬프트
   * @param systemPrompt 시스템 프롬프트
   * @param options 옵션 (jsonMode 등)
   */
  async gptOrchestrate(
    prompt: string,
    systemPrompt: string = 'You are a helpful assistant.',
    options?: { jsonMode?: boolean }
  ): Promise<string> {
    return gptApi.vibeGptOrchestrate(prompt, systemPrompt, options);
  }

  // ============================================
  // Gemini Integration (UI/UX 분석, 코드 분석)
  // ============================================

  /**
   * Gemini 웹 검색
   * @param query 검색 쿼리
   */
  async geminiWebSearch(query: string): Promise<string> {
    return geminiApi.quickWebSearch(query);
  }

  /**
   * Gemini 오케스트레이션
   * @param prompt 프롬프트
   * @param systemPrompt 시스템 프롬프트
   * @param options 옵션 (jsonMode 등)
   */
  async geminiOrchestrate(
    prompt: string,
    systemPrompt: string = 'You are a helpful assistant.',
    options?: { jsonMode?: boolean }
  ): Promise<string> {
    return geminiApi.vibeGeminiOrchestrate(prompt, systemPrompt, options);
  }

  // ============================================
  // Multi-LLM Orchestration
  // ============================================

  /**
   * 멀티 LLM 병렬 쿼리
   * GPT, Gemini 동시 호출하여 결과 비교
   */
  async multiLlmQuery(
    prompt: string,
    options?: { useGpt?: boolean; useGemini?: boolean }
  ): Promise<{ gpt?: string; gemini?: string }> {
    const { useGpt = true, useGemini = true } = options || {};
    const results: { gpt?: string; gemini?: string } = {};

    const promises: Promise<void>[] = [];

    if (useGpt) {
      promises.push(
        gptApi.vibeGptOrchestrate(prompt, 'You are a helpful assistant.', { jsonMode: false })
          .then(r => { results.gpt = r; }).catch(e => { warnLog('GPT query failed in multiLlm', e); })
      );
    }

    if (useGemini) {
      promises.push(
        geminiApi.vibeGeminiOrchestrate(prompt, 'You are a helpful assistant.', { jsonMode: false })
          .then(r => { results.gemini = r; }).catch(e => { warnLog('Gemini query failed in multiLlm', e); })
      );
    }

    await Promise.all(promises);
    return results;
  }

  /**
   * LLM 상태 확인 (전체)
   */
  async checkLlmStatus(): Promise<{
    gpt: { available: boolean };
    gemini: { available: boolean };
  }> {
    // GPT/Gemini는 실제 호출로 확인
    let gptAvailable = false;
    let geminiAvailable = false;

    try {
      await gptApi.vibeGptOrchestrate('ping', 'Reply with pong', { jsonMode: false });
      gptAvailable = true;
    } catch (e) {
      warnLog('GPT status check failed', e);
    }

    try {
      await geminiApi.vibeGeminiOrchestrate('ping', 'Reply with pong', { jsonMode: false });
      geminiAvailable = true;
    } catch (e) {
      warnLog('Gemini status check failed', e);
    }

    return {
      gpt: { available: gptAvailable },
      gemini: { available: geminiAvailable }
    };
  }
}

// 싱글톤 인스턴스 (선택적 사용)
let defaultOrchestrator: VibeOrchestrator | null = null;

export function getOrchestrator(options?: OrchestratorOptions): VibeOrchestrator {
  if (!defaultOrchestrator || options) {
    defaultOrchestrator = new VibeOrchestrator(options);
  }
  return defaultOrchestrator;
}
