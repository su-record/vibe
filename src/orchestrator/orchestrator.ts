/**
 * Orchestrator - 메인 오케스트레이터 클래스
 * /vibe.* 명령어에서 사용할 중앙 오케스트레이션 로직
 *
 * v2.6.0: SmartRouter, LLMCluster, AgentManager로 분리
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  OrchestratorOptions,
  AgentResult,
  BackgroundAgentArgs,
  BackgroundAgentHandle,
  ParallelResearchArgs,
  ParallelResearchResult,
  DiscoveredAgent,
  SmartRouteRequest,
  SmartRouteResult
} from './types.js';
import { ToolResult } from '../types/tool.js';
import {
  parallelResearch,
  createResearchTasks,
  parallelResearchWithMultiLlm
} from './parallelResearch.js';
import { MemoryManager } from '../lib/MemoryManager.js';
import { debugLog, errorLog } from '../lib/utils.js';

// 분리된 모듈 임포트
import { SmartRouter, SmartRouterOptions } from './SmartRouter.js';
import { LLMCluster, LLMClusterOptions, MultiLlmQueryResult, LlmStatusResult } from './LLMCluster.js';
import { AgentManager, AgentManagerOptions } from './AgentManager.js';

/**
 * Vibe Orchestrator
 * 모든 /vibe.* 명령어의 오케스트레이션을 담당
 */
export class VibeOrchestrator {
  private options: OrchestratorOptions;
  private memoryManager: MemoryManager;

  // 분리된 컴포넌트
  private router: SmartRouter;
  private llmCluster: LLMCluster;
  private agentManager: AgentManager;

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      projectPath: process.cwd(),
      verbose: false,
      saveResults: true,
      resultsPath: '.claude/vibe/orchestrator',
      ...options
    };

    this.memoryManager = MemoryManager.getInstance(this.options.projectPath);

    // 컴포넌트 초기화
    this.router = new SmartRouter({ verbose: this.options.verbose });
    this.llmCluster = new LLMCluster();
    this.agentManager = new AgentManager({ projectPath: this.options.projectPath });
  }

  // ============================================
  // Smart Routing (SmartRouter 위임)
  // ============================================

  async smartRoute(request: SmartRouteRequest): Promise<SmartRouteResult> {
    return this.router.route(request);
  }

  async smartWebSearch(query: string): Promise<SmartRouteResult> {
    return this.router.webSearch(query);
  }

  async smartArchitectureReview(prompt: string): Promise<SmartRouteResult> {
    return this.router.architectureReview(prompt);
  }

  async smartUiuxReview(prompt: string): Promise<SmartRouteResult> {
    return this.router.uiuxReview(prompt);
  }

  async smartCodeAnalysis(prompt: string): Promise<SmartRouteResult> {
    return this.router.codeAnalysis(prompt);
  }

  async smartDebugging(prompt: string): Promise<SmartRouteResult> {
    return this.router.debugging(prompt);
  }

  async smartCodeGen(description: string, context?: string): Promise<SmartRouteResult> {
    return this.router.codeGen(description, context);
  }

  // ============================================
  // Agent Management (AgentManager 위임)
  // ============================================

  async discoverAgents(category?: string): Promise<DiscoveredAgent[]> {
    return this.agentManager.discover(category);
  }

  async loadAgent(agentName: string): Promise<DiscoveredAgent | null> {
    return this.agentManager.load(agentName);
  }

  async launchAgent(args: BackgroundAgentArgs): Promise<BackgroundAgentHandle | null> {
    return this.agentManager.launch(args);
  }

  async launchAgents(configs: BackgroundAgentArgs[]): Promise<BackgroundAgentHandle[]> {
    return this.agentManager.launchParallel(configs);
  }

  async getAgentResult(sessionId: string): Promise<AgentResult | null> {
    return this.agentManager.getResult(sessionId);
  }

  cancelAgent(sessionId: string): boolean {
    return this.agentManager.cancel(sessionId);
  }

  getActiveSessions(): ToolResult {
    return this.agentManager.getActiveSessions();
  }

  getHistory(limit: number = 10): ToolResult {
    return this.agentManager.getHistory(limit);
  }

  async runParallelReview(filePaths: string[], techStack: string[] = []): Promise<AgentResult[]> {
    const results = await this.agentManager.runParallelReview(filePaths, techStack);

    if (this.options.saveResults) {
      await this.saveOrchestratorResult('review', { results, filePaths, techStack });
    }

    return results;
  }

  // ============================================
  // Parallel Research
  // ============================================

  async runParallelResearch(args: ParallelResearchArgs): Promise<ParallelResearchResult> {
    const result = await parallelResearch({
      ...args,
      projectPath: args.projectPath || this.options.projectPath
    });

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

  async researchFeature(feature: string, techStack: string[] = []): Promise<ParallelResearchResult> {
    const tasks = createResearchTasks(feature, techStack);

    const result = await parallelResearchWithMultiLlm({
      tasks,
      projectPath: this.options.projectPath,
      feature,
      techStack
    });

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

  // ============================================
  // LLM Integration (LLMCluster 위임)
  // ============================================

  /** @deprecated GPT Codex API는 웹 검색을 지원하지 않습니다. geminiWebSearch를 사용하세요. */
  async gptWebSearch(query: string): Promise<string> {
    return this.llmCluster.gptWebSearch(query);
  }

  async gptOrchestrate(
    prompt: string,
    systemPrompt?: string,
    options?: { jsonMode?: boolean }
  ): Promise<string> {
    return this.llmCluster.gptOrchestrate(prompt, systemPrompt, options);
  }

  async geminiWebSearch(query: string): Promise<string> {
    return this.llmCluster.geminiWebSearch(query);
  }

  async geminiOrchestrate(
    prompt: string,
    systemPrompt?: string,
    options?: { jsonMode?: boolean }
  ): Promise<string> {
    return this.llmCluster.geminiOrchestrate(prompt, systemPrompt, options);
  }

  async multiLlmQuery(
    prompt: string,
    options?: { useGpt?: boolean; useGemini?: boolean }
  ): Promise<MultiLlmQueryResult> {
    return this.llmCluster.multiQuery(prompt, options);
  }

  async checkLlmStatus(): Promise<LlmStatusResult> {
    return this.llmCluster.checkStatus();
  }

  // ============================================
  // Memory Management
  // ============================================

  saveToMemory(key: string, value: string, category: string = 'orchestrator'): void {
    this.memoryManager.save(key, value, category);
  }

  getFromMemory(key: string): string | null {
    const memory = this.memoryManager.recall(key);
    return memory?.value || null;
  }

  // ============================================
  // Internal Utilities
  // ============================================

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

  // ============================================
  // Component Accessors (고급 사용)
  // ============================================

  getRouter(): SmartRouter {
    return this.router;
  }

  getLLMCluster(): LLMCluster {
    return this.llmCluster;
  }

  getAgentManager(): AgentManager {
    return this.agentManager;
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
