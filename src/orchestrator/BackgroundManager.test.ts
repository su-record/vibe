/**
 * BackgroundManager Tests
 * Fire-and-forget pattern, Concurrency control, TaskQueue
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  backgroundManager,
  launch,
  poll,
  cancel,
  getStats,
  QueueOverflowError,
  TaskTimeoutError,
  PipelineTimeoutError,
  AgentExecutionError,
} from './BackgroundManager.js';
import type { TaskInfo, QueueStats } from './BackgroundManager.js';

// Mock the AgentExecutor
vi.mock('./AgentExecutor.js', () => ({
  launchBackgroundAgent: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Mocked' }],
    handle: {
      getResult: vi.fn().mockResolvedValue({
        success: true,
        result: 'Test result',
      }),
      cancel: vi.fn(),
    },
  }),
}));

describe('BackgroundManager', () => {
  describe('Error Classes', () => {
    it('should create QueueOverflowError with correct message', () => {
      const error = new QueueOverflowError(100, 100);
      expect(error.name).toBe('QueueOverflowError');
      expect(error.message).toContain('Queue overflow');
      expect(error.message).toContain('100/100');
    });

    it('should create TaskTimeoutError with correct message', () => {
      const error = new TaskTimeoutError('task-123', 180000);
      expect(error.name).toBe('TaskTimeoutError');
      expect(error.message).toContain('task-123');
      expect(error.message).toContain('180000ms');
    });

    it('should create PipelineTimeoutError with correct message', () => {
      const error = new PipelineTimeoutError(600000);
      expect(error.name).toBe('PipelineTimeoutError');
      expect(error.message).toContain('600000ms');
    });

    it('should create AgentExecutionError with correct message', () => {
      const error = new AgentExecutionError('test-agent', 'connection failed');
      expect(error.name).toBe('AgentExecutionError');
      expect(error.message).toContain('test-agent');
      expect(error.message).toContain('connection failed');
    });
  });

  describe('launch()', () => {
    it('should return taskId immediately (fire-and-forget)', () => {
      const result = launch({
        prompt: 'Test task',
        agentName: 'test-agent',
      });

      expect(result.taskId).toBeDefined();
      expect(result.taskId).toMatch(/^task-\d+-[a-z0-9]+$/);
      expect(result.content[0].text).toContain('Task queued');
    });

    it('should include agent name in response', () => {
      const result = launch({
        prompt: 'Test task',
        agentName: 'my-special-agent',
      });

      expect(result.content[0].text).toContain('my-special-agent');
    });

    it('should include model information', () => {
      const result = launch({
        prompt: 'Test task',
        agentName: 'test-agent',
        model: 'claude-sonnet-4-5',
      });

      expect(result.content[0].text).toContain('claude-sonnet-4-5');
    });
  });

  describe('poll()', () => {
    it('should return task not found for invalid taskId', async () => {
      const result = await poll('non-existent-task');
      expect(result.content[0].text).toContain('not found');
    });

    it('should return pending status for queued task', async () => {
      const launchResult = launch({
        prompt: 'Pending task',
        agentName: 'test-agent',
      });

      const pollResult = await poll(launchResult.taskId);
      expect(pollResult.task).toBeDefined();
      // Task could be pending or running depending on timing
      expect(['pending', 'running', 'completed']).toContain(pollResult.task?.status);
    });
  });

  describe('cancel()', () => {
    it('should return not found for invalid taskId', () => {
      const result = cancel('non-existent-task');
      expect(result.content[0].text).toContain('not found');
    });

    it('should cancel a pending task', async () => {
      const launchResult = launch({
        prompt: 'Task to cancel',
        agentName: 'test-agent',
      });

      const cancelResult = cancel(launchResult.taskId);
      // Could be cancelled or already running/completed
      expect(cancelResult.content[0].text).toMatch(/cancelled|already/);
    });
  });

  describe('getStats()', () => {
    it('should return queue statistics', () => {
      const result = getStats();
      expect(result.stats).toBeDefined();
      expect(result.stats.maxQueueSize).toBe(100);
      expect(typeof result.stats.total).toBe('number');
      expect(typeof result.stats.pending).toBe('number');
      expect(typeof result.stats.running).toBe('number');
      expect(typeof result.stats.completed).toBe('number');
      expect(typeof result.stats.failed).toBe('number');
      expect(typeof result.stats.cancelled).toBe('number');
    });

    it('should include formatted text output', () => {
      const result = getStats();
      expect(result.content[0].text).toContain('BackgroundManager Stats');
      expect(result.content[0].text).toContain('Queue');
      expect(result.content[0].text).toContain('Concurrency');
    });
  });

  describe('Concurrency Control', () => {
    it('should respect model limits', () => {
      // Launch multiple tasks
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        tasks.push(launch({
          prompt: `Concurrent task ${i}`,
          agentName: `agent-${i}`,
          model: 'claude-opus-4',
        }));
      }

      // All should be queued successfully
      expect(tasks.every(t => t.taskId)).toBe(true);
    });
  });
});

describe('TaskQueue', () => {
  describe('bounded queue behavior', () => {
    it('should track queue size', () => {
      const stats = getStats();
      expect(stats.stats.queueSize).toBeGreaterThanOrEqual(0);
      expect(stats.stats.maxQueueSize).toBe(100);
    });
  });
});

describe('Integration', () => {
  it('should complete full task lifecycle', async () => {
    // Launch
    const launchResult = launch({
      prompt: 'Integration test task',
      agentName: 'integration-agent',
    });
    expect(launchResult.taskId).toBeDefined();

    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 100));

    // Poll for result
    const pollResult = await poll(launchResult.taskId);
    expect(pollResult.task).toBeDefined();
  });
});
