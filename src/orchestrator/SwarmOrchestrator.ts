/**
 * SwarmOrchestrator - 에이전트 자가 복제 패턴 (Swarm Pattern)
 * v2.7.0: 복잡한 작업을 자동으로 분할하여 병렬 처리
 *
 * SKILL.md 참조: Claude Code의 Swarm 패턴을 Vibe 자체 구현으로 재현
 * - 에이전트가 "너무 복잡하다" 판단 시 하위 에이전트 동적 생성
 * - 기존 launch()/poll() 인프라 활용
 * - Claude Code + Cursor IDE 모두 지원 (플랫폼 독립)
 */

import { ToolResult } from '../types/tool.js';
import { launch, poll, cancel } from './BackgroundManager.js';
import type { TaskInfo, TaskStatus, QueueStats } from './BackgroundManager.js';
import type { AgentResult, ClaudeModel, BackgroundAgentArgs } from './types.js';
import { DEFAULT_MODELS } from '../lib/constants.js';
import { warnLog } from '../lib/utils.js';

// ============================================
// Swarm Types
// ============================================

/** Swarm 설정 */
export interface SwarmConfig {
  /** 루트 프롬프트 */
  prompt: string;
  /** 에이전트 이름 (선택) */
  agentName?: string;
  /** 모델 (기본: sonnet) */
  model?: ClaudeModel;
  /** 최대 분할 깊이 (기본: 2) */
  maxDepth?: number;
  /** 복잡도 임계값 - 이 이상이면 분할 (기본: 15) */
  splitThreshold?: number;
  /** 최대 동시 하위 에이전트 수 (기본: 5) */
  maxConcurrentChildren?: number;
  /** 분할 시 콜백 */
  onSplit?: (task: SwarmTask) => void;
  /** 완료 시 콜백 */
  onComplete?: (task: SwarmTask, result: AgentResult) => void;
  /** 프로젝트 경로 */
  projectPath?: string;
  /** 타임아웃 (ms, 기본: 5분) */
  timeout?: number;
}

/** Swarm 작업 */
export interface SwarmTask {
  id: string;
  parentId: string | null;
  prompt: string;
  depth: number;
  status: 'pending' | 'analyzing' | 'running' | 'splitting' | 'completed' | 'failed';
  complexity?: number;
  children: string[];
  taskId?: string; // BackgroundManager taskId
  result?: AgentResult;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/** Swarm 결과 */
export interface SwarmResult {
  rootTaskId: string;
  tasks: SwarmTask[];
  totalDuration: number;
  splitCount: number;
  successCount: number;
  failureCount: number;
  maxDepthReached: number;
  mergedResult: string;
}

/** 복잡도 분석 결과 */
interface ComplexityAnalysis {
  score: number;
  factors: string[];
  suggestedSplits?: string[];
}

// ============================================
// SwarmOrchestrator
// ============================================

export class SwarmOrchestrator {
  private tasks = new Map<string, SwarmTask>();
  private config: Required<SwarmConfig>;
  private startTime: number = 0;

  constructor(config: SwarmConfig) {
    this.config = {
      prompt: config.prompt,
      agentName: config.agentName || 'swarm-root',
      model: config.model || DEFAULT_MODELS.BACKGROUND,
      maxDepth: config.maxDepth ?? 2,
      splitThreshold: config.splitThreshold ?? 15,
      maxConcurrentChildren: config.maxConcurrentChildren ?? 5,
      onSplit: config.onSplit || (() => {}),
      onComplete: config.onComplete || (() => {}),
      projectPath: config.projectPath || process.cwd(),
      timeout: config.timeout ?? 5 * 60 * 1000
    };
  }

  /**
   * Swarm 실행
   */
  async execute(): Promise<SwarmResult> {
    this.startTime = Date.now();

    // 루트 태스크 생성
    const rootTask = this.createTask(this.config.prompt, null, 0);
    this.tasks.set(rootTask.id, rootTask);

    // 실행
    await this.processTask(rootTask);

    // 결과 수집
    return this.collectResults(rootTask.id);
  }

  /**
   * 태스크 처리
   */
  private async processTask(task: SwarmTask): Promise<void> {
    // 타임아웃 체크
    if (Date.now() - this.startTime > this.config.timeout) {
      task.status = 'failed';
      task.error = 'Swarm timeout exceeded';
      return;
    }

    task.status = 'analyzing';
    task.startedAt = Date.now();

    // 복잡도 분석
    const analysis = await this.analyzeComplexity(task.prompt);
    task.complexity = analysis.score;

    // 분할 결정
    if (this.shouldSplit(task, analysis)) {
      await this.splitTask(task, analysis);
    } else {
      await this.executeTask(task);
    }
  }

  /**
   * 복잡도 분석
   */
  private async analyzeComplexity(prompt: string): Promise<ComplexityAnalysis> {
    const factors: string[] = [];
    let score = 0;

    // 프롬프트 길이
    if (prompt.length > 500) {
      score += 5;
      factors.push('long-prompt');
    }
    if (prompt.length > 1000) {
      score += 5;
      factors.push('very-long-prompt');
    }

    // 키워드 기반 복잡도
    const complexKeywords = [
      { pattern: /implement|create|build/gi, weight: 3 },
      { pattern: /refactor|restructure|redesign/gi, weight: 4 },
      { pattern: /multiple|several|all|every/gi, weight: 2 },
      { pattern: /and then|after that|next/gi, weight: 2 },
      { pattern: /test|verify|validate/gi, weight: 2 },
      { pattern: /security|authentication|authorization/gi, weight: 3 },
      { pattern: /database|migration|schema/gi, weight: 3 },
      { pattern: /api|endpoint|route/gi, weight: 2 },
      { pattern: /frontend|backend|fullstack/gi, weight: 3 },
      { pattern: /phase|step|stage/gi, weight: 2 }
    ];

    for (const { pattern, weight } of complexKeywords) {
      const matches = prompt.match(pattern);
      if (matches) {
        score += weight * matches.length;
        factors.push(pattern.source.split('|')[0]);
      }
    }

    // 파일/경로 언급
    const fileMentions = prompt.match(/\.(ts|js|tsx|jsx|py|go|rs|java|rb|swift|kt)/gi);
    if (fileMentions && fileMentions.length > 3) {
      score += fileMentions.length * 2;
      factors.push(`${fileMentions.length}-files`);
    }

    // 숫자 목록 (1. 2. 3. 등)
    const numberedList = prompt.match(/^\d+\./gm);
    if (numberedList && numberedList.length > 2) {
      score += numberedList.length * 2;
      factors.push(`${numberedList.length}-steps`);
    }

    // 분할 제안 생성
    const suggestedSplits = this.suggestSplits(prompt);

    return { score, factors, suggestedSplits };
  }

  /**
   * 분할 제안 생성
   */
  private suggestSplits(prompt: string): string[] {
    const splits: string[] = [];

    // 숫자 목록으로 분할
    const numberedSections = prompt.split(/(?=\d+\.\s)/);
    if (numberedSections.length > 2) {
      for (const section of numberedSections) {
        const trimmed = section.trim();
        if (trimmed.length > 20) {
          splits.push(trimmed);
        }
      }
      if (splits.length > 1) return splits;
    }

    // "and", "then" 등으로 분할
    const conjunctionSplit = prompt.split(/\s+(?:and then|then|after that|next,?)\s+/i);
    if (conjunctionSplit.length > 1) {
      return conjunctionSplit.map(s => s.trim()).filter(s => s.length > 20);
    }

    // 문장 단위 분할 (fallback)
    const sentences = prompt.split(/(?<=[.!?])\s+/);
    if (sentences.length > 3) {
      // 2-3개 문장씩 그룹화
      const grouped: string[] = [];
      for (let i = 0; i < sentences.length; i += 2) {
        const group = sentences.slice(i, i + 2).join(' ');
        if (group.length > 30) {
          grouped.push(group);
        }
      }
      if (grouped.length > 1) return grouped;
    }

    return [];
  }

  /**
   * 분할 여부 결정
   */
  private shouldSplit(task: SwarmTask, analysis: ComplexityAnalysis): boolean {
    // 최대 깊이 도달
    if (task.depth >= this.config.maxDepth) {
      return false;
    }

    // 복잡도 임계값 미달
    if (analysis.score < this.config.splitThreshold) {
      return false;
    }

    // 분할 가능한 항목이 없음
    if (!analysis.suggestedSplits || analysis.suggestedSplits.length < 2) {
      return false;
    }

    return true;
  }

  /**
   * 태스크 분할
   */
  private async splitTask(task: SwarmTask, analysis: ComplexityAnalysis): Promise<void> {
    task.status = 'splitting';
    this.config.onSplit(task);

    const splits = analysis.suggestedSplits || [];
    const childTasks: SwarmTask[] = [];

    // 하위 태스크 생성
    for (let i = 0; i < Math.min(splits.length, this.config.maxConcurrentChildren); i++) {
      const childPrompt = this.createChildPrompt(splits[i], i + 1, splits.length);
      const childTask = this.createTask(childPrompt, task.id, task.depth + 1);
      this.tasks.set(childTask.id, childTask);
      task.children.push(childTask.id);
      childTasks.push(childTask);
    }

    // 병렬 실행
    await Promise.all(childTasks.map(child => this.processTask(child)));

    // 결과 병합
    await this.mergeChildResults(task);
  }

  /**
   * 하위 프롬프트 생성
   */
  private createChildPrompt(content: string, index: number, total: number): string {
    return `[Part ${index}/${total}] ${content}`;
  }

  /**
   * 하위 결과 병합
   */
  private async mergeChildResults(task: SwarmTask): Promise<void> {
    const childResults: string[] = [];
    let allSuccess = true;

    for (const childId of task.children) {
      const child = this.tasks.get(childId);
      if (child) {
        if (child.status === 'completed' && child.result) {
          childResults.push(`## Part ${task.children.indexOf(childId) + 1}\n${child.result.result}`);
        } else if (child.status === 'failed') {
          allSuccess = false;
          childResults.push(`## Part ${task.children.indexOf(childId) + 1}\n[FAILED] ${child.error || 'Unknown error'}`);
        }
      }
    }

    task.status = allSuccess ? 'completed' : 'failed';
    task.completedAt = Date.now();
    task.result = {
      agentName: `${this.config.agentName}-merged`,
      sessionId: task.id,
      result: childResults.join('\n\n'),
      success: allSuccess,
      duration: task.completedAt - (task.startedAt || task.createdAt)
    };

    this.config.onComplete(task, task.result);
  }

  /**
   * 태스크 실행 (분할 없이)
   */
  private async executeTask(task: SwarmTask): Promise<void> {
    task.status = 'running';

    const args: BackgroundAgentArgs = {
      prompt: task.prompt,
      agentName: `${this.config.agentName}-${task.depth}-${task.id.slice(-6)}`,
      model: this.config.model,
      projectPath: this.config.projectPath
    };

    // launch로 백그라운드 실행
    const launchResult = launch(args);
    task.taskId = launchResult.taskId;

    // poll로 결과 대기
    let pollResult = await poll(launchResult.taskId);
    while (pollResult.task?.status === 'pending' || pollResult.task?.status === 'running') {
      await this.sleep(500);
      pollResult = await poll(launchResult.taskId);
    }

    if (pollResult.result) {
      task.result = pollResult.result;
      task.status = pollResult.result.success ? 'completed' : 'failed';
      if (!pollResult.result.success) {
        task.error = pollResult.result.error;
      }
    } else {
      task.status = 'failed';
      task.error = 'No result from agent';
    }

    task.completedAt = Date.now();

    if (task.result) {
      this.config.onComplete(task, task.result);
    }
  }

  /**
   * 결과 수집
   */
  private collectResults(rootTaskId: string): SwarmResult {
    const allTasks = Array.from(this.tasks.values());
    const rootTask = this.tasks.get(rootTaskId)!;

    let maxDepth = 0;
    let splitCount = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const task of allTasks) {
      maxDepth = Math.max(maxDepth, task.depth);
      if (task.children.length > 0) splitCount++;
      if (task.status === 'completed') successCount++;
      if (task.status === 'failed') failureCount++;
    }

    return {
      rootTaskId,
      tasks: allTasks,
      totalDuration: Date.now() - this.startTime,
      splitCount,
      successCount,
      failureCount,
      maxDepthReached: maxDepth,
      mergedResult: rootTask.result?.result || ''
    };
  }

  /**
   * 태스크 생성
   */
  private createTask(prompt: string, parentId: string | null, depth: number): SwarmTask {
    return {
      id: `swarm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      parentId,
      prompt,
      depth,
      status: 'pending',
      children: [],
      createdAt: Date.now()
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// 편의 함수
// ============================================

/**
 * Swarm 패턴으로 복잡한 작업 실행
 *
 * @example
 * import { swarm } from '@su-record/vibe/orchestrator';
 *
 * const result = await swarm({
 *   prompt: 'Implement login feature with: 1. UI form 2. Validation 3. API call 4. Error handling',
 *   maxDepth: 2,
 *   splitThreshold: 15,
 *   onSplit: (task) => console.log(`Splitting: ${task.id}`),
 * });
 */
export async function swarm(config: SwarmConfig): Promise<ToolResult & { swarmResult: SwarmResult }> {
  const orchestrator = new SwarmOrchestrator(config);
  const result = await orchestrator.execute();

  const statusEmoji = result.failureCount === 0 ? '✅' : result.successCount > 0 ? '⚠️' : '❌';

  let summary = `## Swarm Execution ${statusEmoji}\n\n`;
  summary += `**Duration**: ${(result.totalDuration / 1000).toFixed(1)}s\n`;
  summary += `**Tasks**: ${result.tasks.length} (${result.splitCount} splits)\n`;
  summary += `**Max Depth**: ${result.maxDepthReached}/${config.maxDepth || 2}\n`;
  summary += `**Success**: ${result.successCount}/${result.tasks.length}\n\n`;

  if (result.mergedResult) {
    summary += `### Result\n\n${result.mergedResult}`;
  }

  return {
    content: [{ type: 'text', text: summary }],
    swarmResult: result
  };
}

/**
 * 작업 복잡도 분석 (swarm 없이)
 *
 * @example
 * const analysis = analyzeTaskComplexity('Implement login with validation and error handling');
 * console.log(analysis.score); // 15
 */
export function analyzeTaskComplexity(prompt: string): ComplexityAnalysis {
  const orchestrator = new SwarmOrchestrator({ prompt });
  // @ts-expect-error - private method access for utility
  return orchestrator.analyzeComplexity(prompt);
}
