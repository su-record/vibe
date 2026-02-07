/**
 * TaskExecutor - DAG execution engine
 * Topological sort → parallel execution with semaphore
 * Partial failure handling, progress notifications
 */

import { InterfaceLogger } from '../../interface/types.js';
import { NotificationManager } from '../notifications/NotificationManager.js';
import { DAG, DAGNode, TaskPlanner } from './TaskPlanner.js';

const MAX_PARALLEL = 3;
const NODE_TIMEOUT_MS = 120_000;
const TOTAL_TIMEOUT_MS = 600_000;

export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface NodeResult {
  nodeId: string;
  status: NodeStatus;
  data?: string;
  error?: string;
  durationMs: number;
}

export interface ExecutionResult {
  success: boolean;
  results: NodeResult[];
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  skippedNodes: number;
  totalDurationMs: number;
}

type NodeExecuteFn = (node: DAGNode, context: Map<string, string>) => Promise<string>;

export class TaskExecutor {
  private logger: InterfaceLogger;
  private notificationMgr: NotificationManager | null;
  private chatId: string | null;

  constructor(
    logger: InterfaceLogger,
    notificationMgr?: NotificationManager,
    chatId?: string,
  ) {
    this.logger = logger;
    this.notificationMgr = notificationMgr ?? null;
    this.chatId = chatId ?? null;
  }

  /** Execute a DAG with topological ordering and parallel execution */
  async execute(dag: DAG, executeFn: NodeExecuteFn): Promise<ExecutionResult> {
    const startTime = Date.now();
    const order = TaskPlanner.topologicalSort(dag);
    const nodeMap = new Map(dag.nodes.map((n) => [n.id, n]));
    const context = new Map<string, string>();
    const results = new Map<string, NodeResult>();
    const failedIds = new Set<string>();

    const levels = this.buildExecutionLevels(dag, order);

    for (const level of levels) {
      if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
        this.markRemaining(level, results, 'skipped', '전체 타임아웃 초과');
        break;
      }
      await this.executeLevel(level, nodeMap, executeFn, context, results, failedIds, startTime);
    }

    return this.buildResult(results, dag.nodes.length, Date.now() - startTime);
  }

  /** Format execution result for Telegram */
  static formatResult(result: ExecutionResult): string {
    const statusLine = `${result.completedNodes}/${result.totalNodes} 완료` +
      (result.failedNodes > 0 ? `, ${result.failedNodes}개 실패` : '') +
      (result.skippedNodes > 0 ? `, ${result.skippedNodes}개 건너뜀` : '');

    const parts = [`📊 복합 작업 결과 (${statusLine}):`];

    for (const r of result.results) {
      const icon = r.status === 'completed' ? '✅' : r.status === 'failed' ? '❌' : '⏭️';
      const detail = r.data ? r.data.slice(0, 200) : (r.error ?? '');
      parts.push(`${icon} Step ${r.nodeId}: ${detail}`);
    }

    return parts.join('\n\n');
  }

  /** Build execution levels (nodes at same depth can run in parallel) */
  private buildExecutionLevels(dag: DAG, order: string[]): string[][] {
    const depthMap = new Map<string, number>();

    for (const nodeId of order) {
      const node = dag.nodes.find((n) => n.id === nodeId)!;
      const maxDepDep = node.dependsOn.reduce(
        (max, dep) => Math.max(max, depthMap.get(dep) ?? 0),
        -1,
      );
      depthMap.set(nodeId, maxDepDep + 1);
    }

    const levels: string[][] = [];
    for (const [nodeId, depth] of depthMap) {
      while (levels.length <= depth) levels.push([]);
      levels[depth].push(nodeId);
    }
    return levels;
  }

  /** Execute one level of parallel nodes with semaphore */
  private async executeLevel(
    level: string[],
    nodeMap: Map<string, DAGNode>,
    executeFn: NodeExecuteFn,
    context: Map<string, string>,
    results: Map<string, NodeResult>,
    failedIds: Set<string>,
    globalStart: number,
  ): Promise<void> {
    const executable = level.filter((id) => {
      const node = nodeMap.get(id)!;
      const hasFailedDep = node.dependsOn.some((dep) => failedIds.has(dep));
      if (hasFailedDep) {
        results.set(id, { nodeId: id, status: 'skipped', error: '의존 노드 실패', durationMs: 0 });
        return false;
      }
      return true;
    });

    // Execute with concurrency limit
    for (let i = 0; i < executable.length; i += MAX_PARALLEL) {
      const batch = executable.slice(i, i + MAX_PARALLEL);
      const promises = batch.map((id) =>
        this.executeNode(nodeMap.get(id)!, executeFn, context, globalStart),
      );
      const batchResults = await Promise.allSettled(promises);

      for (let j = 0; j < batch.length; j++) {
        const nodeId = batch[j];
        const settled = batchResults[j];
        if (settled.status === 'fulfilled') {
          results.set(nodeId, settled.value);
          if (settled.value.status === 'completed' && settled.value.data) {
            context.set(nodeId, settled.value.data);
          } else if (settled.value.status === 'failed') {
            failedIds.add(nodeId);
          }
        } else {
          const errResult: NodeResult = {
            nodeId, status: 'failed', error: settled.reason?.message ?? 'Unknown error', durationMs: 0,
          };
          results.set(nodeId, errResult);
          failedIds.add(nodeId);
        }
      }
    }
  }

  /** Execute a single DAG node with timeout */
  private async executeNode(
    node: DAGNode,
    executeFn: NodeExecuteFn,
    context: Map<string, string>,
    globalStart: number,
  ): Promise<NodeResult> {
    const nodeStart = Date.now();
    await this.notifyProgress(node, 'running');

    try {
      const remaining = TOTAL_TIMEOUT_MS - (Date.now() - globalStart);
      const timeout = Math.min(NODE_TIMEOUT_MS, remaining);
      if (timeout <= 0) {
        return { nodeId: node.id, status: 'skipped', error: '타임아웃', durationMs: 0 };
      }

      const data = await Promise.race([
        executeFn(node, context),
        this.createTimeout(timeout),
      ]);

      await this.notifyProgress(node, 'completed');
      return { nodeId: node.id, status: 'completed', data, durationMs: Date.now() - nodeStart };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await this.notifyProgress(node, 'failed');
      return { nodeId: node.id, status: 'failed', error, durationMs: Date.now() - nodeStart };
    }
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('노드 타임아웃 초과')), ms),
    );
  }

  private async notifyProgress(node: DAGNode, status: NodeStatus): Promise<void> {
    if (!this.notificationMgr || !this.chatId) return;
    const icon = status === 'running' ? '⏳' : status === 'completed' ? '✅' : '❌';
    const text = `${icon} Step ${node.id}: ${node.action} (${status})`;
    await this.notificationMgr.send(this.chatId, text, 'low');
  }

  private markRemaining(
    nodeIds: string[],
    results: Map<string, NodeResult>,
    status: NodeStatus,
    error: string,
  ): void {
    for (const id of nodeIds) {
      if (!results.has(id)) {
        results.set(id, { nodeId: id, status, error, durationMs: 0 });
      }
    }
  }

  private buildResult(
    results: Map<string, NodeResult>,
    totalNodes: number,
    totalDurationMs: number,
  ): ExecutionResult {
    const allResults = [...results.values()];
    const completed = allResults.filter((r) => r.status === 'completed').length;
    const failed = allResults.filter((r) => r.status === 'failed').length;
    const skipped = allResults.filter((r) => r.status === 'skipped').length;

    return {
      success: failed === 0 && skipped === 0,
      results: allResults,
      totalNodes,
      completedNodes: completed,
      failedNodes: failed,
      skippedNodes: skipped,
      totalDurationMs,
    };
  }
}
