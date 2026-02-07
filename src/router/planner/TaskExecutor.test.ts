/**
 * TaskExecutor Tests
 * Sequential/parallel execution, timeout, partial failure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskExecutor } from './TaskExecutor.js';
import { DAG, DAGNode } from './TaskPlanner.js';

const mockLogger = vi.fn();

function createSimpleDAG(): DAG {
  return {
    description: 'Simple sequential DAG',
    nodes: [
      { id: '1', type: 'research', action: 'web_search', dependsOn: [], params: {} },
      { id: '2', type: 'google', action: 'gmail_send', dependsOn: ['1'], params: {} },
    ],
  };
}

function createParallelDAG(): DAG {
  return {
    description: 'Parallel DAG',
    nodes: [
      { id: '1', type: 'research', action: 'search', dependsOn: [], params: {} },
      { id: '2', type: 'research', action: 'summarize', dependsOn: ['1'], params: {} },
      { id: '3', type: 'google', action: 'sheets_write', dependsOn: ['2'], params: {} },
      { id: '4', type: 'google', action: 'gmail_send', dependsOn: ['2'], params: {} },
    ],
  };
}

describe('TaskExecutor', () => {
  let executor: TaskExecutor;

  beforeEach(() => {
    mockLogger.mockClear();
    executor = new TaskExecutor(mockLogger);
  });

  describe('execute - sequential', () => {
    it('should execute nodes in dependency order', async () => {
      const executionOrder: string[] = [];
      const executeFn = async (node: DAGNode): Promise<string> => {
        executionOrder.push(node.id);
        return `result-${node.id}`;
      };

      const result = await executor.execute(createSimpleDAG(), executeFn);
      expect(result.success).toBe(true);
      expect(result.completedNodes).toBe(2);
      expect(executionOrder).toEqual(['1', '2']);
    });

    it('should pass context from previous nodes', async () => {
      const receivedContexts: Map<string, string>[] = [];
      const executeFn = async (node: DAGNode, ctx: Map<string, string>): Promise<string> => {
        receivedContexts.push(new Map(ctx));
        return `data-from-${node.id}`;
      };

      await executor.execute(createSimpleDAG(), executeFn);
      expect(receivedContexts[1].get('1')).toBe('data-from-1');
    });
  });

  describe('execute - parallel', () => {
    it('should execute independent nodes in parallel', async () => {
      const executeFn = async (node: DAGNode): Promise<string> => {
        return `result-${node.id}`;
      };

      const result = await executor.execute(createParallelDAG(), executeFn);
      expect(result.success).toBe(true);
      expect(result.completedNodes).toBe(4);
    });
  });

  describe('execute - partial failure', () => {
    it('should handle node failure and skip dependents', async () => {
      const dag: DAG = {
        description: 'Fail test',
        nodes: [
          { id: '1', type: 'research', action: 'search', dependsOn: [], params: {} },
          { id: '2', type: 'research', action: 'summarize', dependsOn: ['1'], params: {} },
          { id: '3', type: 'utility', action: 'note', dependsOn: [], params: {} },
        ],
      };

      const executeFn = async (node: DAGNode): Promise<string> => {
        if (node.id === '1') throw new Error('Search failed');
        return `ok-${node.id}`;
      };

      const result = await executor.execute(dag, executeFn);
      expect(result.success).toBe(false);
      expect(result.failedNodes).toBe(1);
      expect(result.skippedNodes).toBe(1); // node 2 skipped (depends on 1)
      expect(result.completedNodes).toBe(1); // node 3 succeeded
    });

    it('should return partial results on failure', async () => {
      const executeFn = async (node: DAGNode): Promise<string> => {
        if (node.id === '2') throw new Error('Gmail failed');
        return `ok-${node.id}`;
      };

      const result = await executor.execute(createSimpleDAG(), executeFn);
      expect(result.results).toHaveLength(2);
      const node1 = result.results.find((r) => r.nodeId === '1');
      const node2 = result.results.find((r) => r.nodeId === '2');
      expect(node1?.status).toBe('completed');
      expect(node2?.status).toBe('failed');
    });
  });

  describe('formatResult', () => {
    it('should format execution result summary', () => {
      const result = {
        success: true,
        results: [
          { nodeId: '1', status: 'completed' as const, data: 'Found 3 results', durationMs: 100 },
          { nodeId: '2', status: 'completed' as const, data: 'Email sent', durationMs: 200 },
        ],
        totalNodes: 2,
        completedNodes: 2,
        failedNodes: 0,
        skippedNodes: 0,
        totalDurationMs: 300,
      };
      const formatted = TaskExecutor.formatResult(result);
      expect(formatted).toContain('2/2 완료');
      expect(formatted).toContain('Found 3 results');
    });
  });
});
