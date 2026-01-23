/**
 * BackgroundManager - Fire-and-forget 패턴 기반 백그라운드 에이전트 매니저
 * v2.6.0: Concurrency Manager + TaskQueue 도입
 */

import {
  BackgroundAgentArgs,
  BackgroundAgentHandle,
  AgentResult,
  ClaudeModel
} from './types.js';
import { ToolResult } from '../types/tool.js';
import { CONCURRENCY, DEFAULT_MODELS } from '../lib/constants.js';
import { warnLog } from '../lib/utils.js';
import { launchBackgroundAgent } from './AgentExecutor.js';

// ============================================
// Error Types (SPEC Error Taxonomy)
// ============================================

/** 큐 용량 초과 에러 */
export class QueueOverflowError extends Error {
  constructor(queueSize: number, maxSize: number) {
    super(`Queue overflow: ${queueSize}/${maxSize}. Retry later.`);
    this.name = 'QueueOverflowError';
  }
}

/** 개별 태스크 타임아웃 에러 */
export class TaskTimeoutError extends Error {
  constructor(taskId: string, timeout: number) {
    super(`Task "${taskId}" exceeded timeout: ${timeout}ms`);
    this.name = 'TaskTimeoutError';
  }
}

/** 전체 파이프라인 타임아웃 에러 */
export class PipelineTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Pipeline exceeded timeout: ${timeout}ms`);
    this.name = 'PipelineTimeoutError';
  }
}

/** Agent 실행 실패 에러 */
export class AgentExecutionError extends Error {
  constructor(agentName: string, reason: string) {
    super(`Agent "${agentName}" execution failed: ${reason}`);
    this.name = 'AgentExecutionError';
  }
}

// ============================================
// Job Lifecycle Types
// ============================================

/** 작업 상태 (SPEC Job Lifecycle) */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** 작업 정보 */
export interface TaskInfo {
  id: string;
  args: BackgroundAgentArgs;
  status: TaskStatus;
  handle?: BackgroundAgentHandle;
  result?: AgentResult;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  model: string;
  provider: string;
}

/** 큐 통계 */
export interface QueueStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  queueSize: number;
  maxQueueSize: number;
}

// ============================================
// ConcurrencyManager - 동시 실행 제한 관리
// ============================================

class ConcurrencyManager {
  private runningByModel = new Map<string, number>();
  private runningByProvider = new Map<string, number>();

  /** 실행 가능 여부 확인 */
  canRun(model: string, provider: string): boolean {
    const modelLimit = this.getModelLimit(model);
    const providerLimit = this.getProviderLimit(provider);
    const currentModel = this.runningByModel.get(model) || 0;
    const currentProvider = this.runningByProvider.get(provider) || 0;
    return currentModel < modelLimit && currentProvider < providerLimit;
  }

  /** 실행 시작 (슬롯 획득) */
  acquire(model: string, provider: string): void {
    const currentModel = this.runningByModel.get(model) || 0;
    const currentProvider = this.runningByProvider.get(provider) || 0;
    this.runningByModel.set(model, currentModel + 1);
    this.runningByProvider.set(provider, currentProvider + 1);
  }

  /** 실행 종료 (슬롯 반환) */
  release(model: string, provider: string): void {
    const currentModel = this.runningByModel.get(model) || 0;
    const currentProvider = this.runningByProvider.get(provider) || 0;
    if (currentModel > 0) this.runningByModel.set(model, currentModel - 1);
    if (currentProvider > 0) this.runningByProvider.set(provider, currentProvider - 1);
  }

  /** 모델별 제한 조회 */
  private getModelLimit(model: string): number {
    return CONCURRENCY.MODEL_LIMITS[model] ?? CONCURRENCY.MODEL_LIMITS['default'];
  }

  /** 프로바이더별 제한 조회 */
  private getProviderLimit(provider: string): number {
    return CONCURRENCY.PROVIDER_LIMITS[provider] ?? CONCURRENCY.PROVIDER_LIMITS['default'];
  }

  /** 현재 상태 조회 */
  getStatus(): { byModel: Record<string, number>; byProvider: Record<string, number> } {
    return {
      byModel: Object.fromEntries(this.runningByModel),
      byProvider: Object.fromEntries(this.runningByProvider)
    };
  }
}

// ============================================
// TaskQueue - Bounded Queue with Backpressure
// ============================================

class TaskQueue {
  private queue: TaskInfo[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number = CONCURRENCY.QUEUE_MAX_SIZE) {
    this.maxSize = maxSize;
  }

  /** 큐에 추가 (backpressure 적용) */
  enqueue(task: TaskInfo): void {
    if (this.queue.length >= this.maxSize) {
      throw new QueueOverflowError(this.queue.length, this.maxSize);
    }
    this.queue.push(task);
  }

  /** 다음 대기 중인 태스크 조회 */
  peek(): TaskInfo | undefined {
    return this.queue.find(t => t.status === 'pending');
  }

  /** 다음 대기 중인 태스크 제거 및 반환 */
  dequeue(): TaskInfo | undefined {
    const index = this.queue.findIndex(t => t.status === 'pending');
    if (index === -1) return undefined;
    return this.queue[index];
  }

  /** 큐 사이즈 */
  get size(): number {
    return this.queue.filter(t => t.status === 'pending').length;
  }

  /** 전체 태스크 수 */
  get totalSize(): number {
    return this.queue.length;
  }

  /** 큐가 비었는지 확인 */
  isEmpty(): boolean {
    return this.size === 0;
  }

  /** 큐가 가득 찼는지 확인 */
  isFull(): boolean {
    return this.queue.length >= this.maxSize;
  }

  /** 태스크 조회 */
  get(taskId: string): TaskInfo | undefined {
    return this.queue.find(t => t.id === taskId);
  }

  /** 완료된 태스크 정리 (24시간 후) */
  cleanup(): number {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const before = this.queue.length;
    this.queue = this.queue.filter(t => {
      if (t.status === 'pending' || t.status === 'running') return true;
      return (t.completedAt || t.createdAt) > cutoff;
    });
    return before - this.queue.length;
  }

  /** 통계 */
  getStats(): QueueStats {
    const stats: QueueStats = {
      total: this.queue.length,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      queueSize: this.size,
      maxQueueSize: this.maxSize
    };
    for (const task of this.queue) {
      stats[task.status]++;
    }
    return stats;
  }

  /** 모든 태스크 */
  getAll(): TaskInfo[] {
    return [...this.queue];
  }
}

// ============================================
// BackgroundManager - 메인 클래스
// ============================================

class BackgroundManagerImpl {
  private readonly concurrency = new ConcurrencyManager();
  private readonly taskQueue = new TaskQueue();
  private readonly tasks = new Map<string, TaskInfo>();
  private processing = false;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      const cleaned = this.taskQueue.cleanup();
      if (cleaned > 0) {
        warnLog(`[BackgroundManager] Cleaned up ${cleaned} old tasks`);
      }
    }, 10 * 60 * 1000); // 10분마다
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Fire-and-forget 방식으로 백그라운드 에이전트 시작
   * 즉시 handle 반환 (< 100ms)
   */
  launch(args: BackgroundAgentArgs): ToolResult & { taskId: string; handle?: BackgroundAgentHandle } {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const model = args.model || DEFAULT_MODELS.BACKGROUND;
    const provider = this.extractProvider(model);

    const task: TaskInfo = {
      id: taskId,
      args,
      status: 'pending',
      createdAt: Date.now(),
      model,
      provider
    };

    try {
      this.taskQueue.enqueue(task);
      this.tasks.set(taskId, task);
    } catch (error) {
      if (error instanceof QueueOverflowError) {
        return {
          content: [{
            type: 'text',
            text: `❌ ${error.message}`
          }],
          taskId,
          isError: true
        } as ToolResult & { taskId: string; isError: boolean };
      }
      throw error;
    }

    // 비동기로 큐 처리 시작 (fire-and-forget)
    this.processQueue().catch(err => {
      warnLog(`[BackgroundManager] Queue processing error: ${err.message}`);
    });

    return {
      content: [{
        type: 'text',
        text: `🚀 Task queued: ${taskId}\nAgent: ${args.agentName || 'unnamed'}\nModel: ${model}\nQueue position: ${this.taskQueue.size}\n\nUse poll("${taskId}") to check status.`
      }],
      taskId
    };
  }

  /**
   * 결과 폴링 (비동기)
   */
  async poll(taskId: string): Promise<ToolResult & { task?: TaskInfo; result?: AgentResult }> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        content: [{ type: 'text', text: `Task "${taskId}" not found` }]
      };
    }

    switch (task.status) {
      case 'pending':
        return {
          content: [{
            type: 'text',
            text: `⏳ Task "${taskId}" is pending\nQueue position: ${this.getQueuePosition(taskId)}`
          }],
          task
        };

      case 'running':
        return {
          content: [{
            type: 'text',
            text: `🔄 Task "${taskId}" is running\nStarted: ${new Date(task.startedAt!).toISOString()}`
          }],
          task
        };

      case 'completed':
        return {
          content: [{
            type: 'text',
            text: `✅ Task "${taskId}" completed\nDuration: ${this.formatDuration(task)}\n\nResult:\n${task.result?.result || 'No result'}`
          }],
          task,
          result: task.result
        };

      case 'failed':
        return {
          content: [{
            type: 'text',
            text: `❌ Task "${taskId}" failed\nError: ${task.error || 'Unknown error'}`
          }],
          task
        };

      case 'cancelled':
        return {
          content: [{
            type: 'text',
            text: `🚫 Task "${taskId}" was cancelled`
          }],
          task
        };
    }
  }

  /**
   * 태스크 취소
   */
  cancel(taskId: string): ToolResult {
    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        content: [{ type: 'text', text: `Task "${taskId}" not found` }]
      };
    }

    if (task.status !== 'pending' && task.status !== 'running') {
      return {
        content: [{ type: 'text', text: `Task "${taskId}" is already ${task.status}` }]
      };
    }

    if (task.handle) {
      task.handle.cancel();
    }
    task.status = 'cancelled';
    task.completedAt = Date.now();

    return {
      content: [{ type: 'text', text: `Task "${taskId}" cancelled` }]
    };
  }

  /**
   * 통계 조회
   */
  getStats(): ToolResult & { stats: QueueStats } {
    const stats = this.taskQueue.getStats();
    const concurrencyStatus = this.concurrency.getStatus();

    let text = `## BackgroundManager Stats\n\n`;
    text += `**Queue**: ${stats.queueSize}/${stats.maxQueueSize}\n`;
    text += `**Total tasks**: ${stats.total}\n`;
    text += `- Pending: ${stats.pending}\n`;
    text += `- Running: ${stats.running}\n`;
    text += `- Completed: ${stats.completed}\n`;
    text += `- Failed: ${stats.failed}\n`;
    text += `- Cancelled: ${stats.cancelled}\n\n`;
    text += `**Concurrency**:\n`;
    text += `- By Model: ${JSON.stringify(concurrencyStatus.byModel)}\n`;
    text += `- By Provider: ${JSON.stringify(concurrencyStatus.byProvider)}\n`;

    return {
      content: [{ type: 'text', text }],
      stats
    };
  }

  /**
   * 큐 처리 (내부)
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (!this.taskQueue.isEmpty()) {
        const task = this.taskQueue.peek();
        if (!task) break;

        if (!this.concurrency.canRun(task.model, task.provider)) {
          await this.sleep(100);
          continue;
        }

        task.status = 'running';
        task.startedAt = Date.now();
        this.concurrency.acquire(task.model, task.provider);

        // Fire-and-forget 실행
        this.executeTask(task).catch(err => {
          warnLog(`[BackgroundManager] Task ${task.id} error: ${err.message}`);
        });
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * 태스크 실행 (내부)
   */
  private async executeTask(task: TaskInfo): Promise<void> {
    const timeout = CONCURRENCY.TASK_TIMEOUT;
    const timeoutId = setTimeout(() => {
      if (task.status === 'running') {
        task.status = 'failed';
        task.error = new TaskTimeoutError(task.id, timeout).message;
        task.completedAt = Date.now();
        this.concurrency.release(task.model, task.provider);
        warnLog(`[BackgroundManager] Task ${task.id} timed out`);
      }
    }, timeout);

    try {
      const result = await launchBackgroundAgent(task.args);
      const handle = (result as ToolResult & { handle?: BackgroundAgentHandle }).handle;

      if (handle) {
        task.handle = handle;
        const agentResult = await handle.getResult();
        task.result = agentResult;
        task.status = agentResult.success ? 'completed' : 'failed';
        if (!agentResult.success) {
          task.error = agentResult.error;
        }
      } else {
        task.status = 'failed';
        task.error = 'No handle returned';
      }
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      warnLog(`[BackgroundManager] Task ${task.id} failed: ${task.error}`);
    } finally {
      clearTimeout(timeoutId);
      task.completedAt = Date.now();
      this.concurrency.release(task.model, task.provider);

      // 큐에 대기 중인 태스크가 있으면 계속 처리
      if (!this.taskQueue.isEmpty()) {
        this.processQueue().catch(() => {});
      }
    }
  }

  private extractProvider(model: string): string {
    if (model.startsWith('claude')) return 'claude';
    if (model.startsWith('gpt')) return 'gpt';
    if (model.startsWith('gemini')) return 'gemini';
    return 'default';
  }

  private getQueuePosition(taskId: string): number {
    const all = this.taskQueue.getAll();
    let position = 0;
    for (const task of all) {
      if (task.status === 'pending') {
        position++;
        if (task.id === taskId) return position;
      }
    }
    return -1;
  }

  private formatDuration(task: TaskInfo): string {
    if (!task.startedAt || !task.completedAt) return 'N/A';
    const ms = task.completedAt - task.startedAt;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 싱글톤 인스턴스
export const backgroundManager = new BackgroundManagerImpl();

// 편의 함수
export function launch(args: BackgroundAgentArgs): ToolResult & { taskId: string } {
  return backgroundManager.launch(args);
}

export function poll(taskId: string): Promise<ToolResult & { task?: TaskInfo; result?: AgentResult }> {
  return backgroundManager.poll(taskId);
}

export function cancel(taskId: string): ToolResult {
  return backgroundManager.cancel(taskId);
}

export function getStats(): ToolResult & { stats: QueueStats } {
  return backgroundManager.getStats();
}
