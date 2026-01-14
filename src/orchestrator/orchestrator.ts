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
  DiscoveredAgent
} from './types.js';
import { ToolResult } from '../types/tool.js';
import { discoverAgents, loadAgent, listAgentsByCategory } from './agentDiscovery.js';
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
      model: 'claude-haiku-3-5', // 리뷰는 빠른 모델
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
        console.log(`Saved orchestrator result: ${filepath}`);
      }
    } catch (error) {
      console.error('Failed to save orchestrator result:', error);
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
}

// 싱글톤 인스턴스 (선택적 사용)
let defaultOrchestrator: VibeOrchestrator | null = null;

export function getOrchestrator(options?: OrchestratorOptions): VibeOrchestrator {
  if (!defaultOrchestrator || options) {
    defaultOrchestrator = new VibeOrchestrator(options);
  }
  return defaultOrchestrator;
}
