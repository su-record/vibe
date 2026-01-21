/**
 * AgentManager - 에이전트 관리 및 실행
 * orchestrator.ts에서 추출된 에이전트 관리 모듈
 */

import {
  AgentResult,
  BackgroundAgentArgs,
  BackgroundAgentHandle,
  DiscoveredAgent
} from './types.js';
import { ToolResult } from '../types/tool.js';
import { discoverAgents, loadAgent, listAgentsByCategory } from './agentDiscovery.js';
import {
  launchBackgroundAgent,
  getBackgroundAgentResult,
  cancelBackgroundAgent,
  listActiveSessions,
  getSessionHistory,
  launchParallelAgents
} from './backgroundAgent.js';
import { DEFAULT_MODELS } from '../lib/constants.js';

/**
 * AgentManager 설정
 */
export interface AgentManagerOptions {
  projectPath?: string;
}

/**
 * AgentManager - 에이전트 탐색, 실행, 결과 관리
 */
export class AgentManager {
  private projectPath: string;

  constructor(options: AgentManagerOptions = {}) {
    this.projectPath = options.projectPath ?? process.cwd();
  }

  /**
   * 에이전트 탐색
   */
  async discover(category?: string): Promise<DiscoveredAgent[]> {
    const result = await discoverAgents({
      projectPath: this.projectPath,
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
  async load(agentName: string): Promise<DiscoveredAgent | null> {
    return loadAgent(agentName, this.projectPath);
  }

  /**
   * 카테고리별 에이전트 목록
   */
  async listByCategory(category: string): Promise<DiscoveredAgent[]> {
    return listAgentsByCategory(category, this.projectPath);
  }

  /**
   * 백그라운드 에이전트 시작
   */
  async launch(args: BackgroundAgentArgs): Promise<BackgroundAgentHandle | null> {
    const result = await launchBackgroundAgent({
      ...args,
      projectPath: args.projectPath || this.projectPath
    });

    if ('handle' in result) {
      return (result as ToolResult & { handle: BackgroundAgentHandle }).handle;
    }
    return null;
  }

  /**
   * 여러 에이전트 동시 실행
   */
  async launchParallel(configs: BackgroundAgentArgs[]): Promise<BackgroundAgentHandle[]> {
    const result = await launchParallelAgents(
      configs.map(c => ({
        ...c,
        projectPath: c.projectPath || this.projectPath
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
  async getResult(sessionId: string): Promise<AgentResult | null> {
    const result = await getBackgroundAgentResult(sessionId);

    if ('result' in result) {
      return (result as ToolResult & { result: AgentResult }).result;
    }
    return null;
  }

  /**
   * 에이전트 취소
   */
  cancel(sessionId: string): boolean {
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
   */
  async runParallelReview(
    filePaths: string[],
    techStack: string[] = []
  ): Promise<AgentResult[]> {
    const reviewAgents = await this.listByCategory('review');
    const relevantAgents = this.filterRelevantAgents(reviewAgents, techStack);

    const agentConfigs: BackgroundAgentArgs[] = relevantAgents.map(agent => ({
      agentName: agent.name,
      prompt: this.buildReviewPrompt(agent, filePaths),
      model: DEFAULT_MODELS.REVIEW,
      maxTurns: 3,
      allowedTools: ['Read', 'Glob', 'Grep']
    }));

    const handles = await this.launchParallel(agentConfigs);

    const results: AgentResult[] = [];
    for (const handle of handles) {
      const result = await handle.getResult();
      results.push(result);
    }

    return results;
  }

  /**
   * 기술 스택에 맞는 에이전트 필터링
   */
  private filterRelevantAgents(
    agents: DiscoveredAgent[],
    techStack: string[]
  ): DiscoveredAgent[] {
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

    const stackReviewers: Record<string, string[]> = {
      typescript: ['typescript-reviewer'],
      python: ['python-reviewer'],
      react: ['react-reviewer'],
      rails: ['rails-reviewer'],
      ruby: ['rails-reviewer']
    };

    const relevantNames = new Set(coreReviewers);

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
   * 프로젝트 경로 업데이트
   */
  setProjectPath(path: string): void {
    this.projectPath = path;
  }
}

// 싱글톤 인스턴스
let defaultManager: AgentManager | null = null;

export function getAgentManager(options?: AgentManagerOptions): AgentManager {
  if (!defaultManager || options) {
    defaultManager = new AgentManager(options);
  }
  return defaultManager;
}
