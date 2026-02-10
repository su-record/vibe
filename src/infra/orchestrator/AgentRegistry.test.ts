/**
 * AgentRegistry Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentRegistry } from './AgentRegistry.js';

const TEST_DIR = path.join(os.tmpdir(), `vibe-registry-test-${process.pid}`);

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
    registry = new AgentRegistry(TEST_DIR);
  });

  afterEach(() => {
    try { registry.close(); } catch { /* ignore */ }
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('should create DB at correct path', () => {
    const dbPath = path.join(TEST_DIR, '.claude', 'vibe', 'agents', 'registry.db');
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('should record start and complete', () => {
    registry.recordStart({
      id: 'exec-1', taskId: 'task-1', agentName: 'test-agent',
      prompt: 'Do something', model: 'claude-sonnet',
    });

    registry.recordComplete('exec-1', 'Task done', 1500);

    const history = registry.getHistory(10);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('completed');
    expect(history[0].duration).toBe(1500);
  });

  it('should record failure with masked errors', () => {
    registry.recordStart({
      id: 'exec-2', taskId: 'task-2', agentName: 'test-agent',
    });

    registry.recordFailure('exec-2', 'Auth failed with sk-1234567890abcdefghijklmno', 500);

    const history = registry.getHistory(10);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('failed');
    expect(history[0].error).not.toContain('sk-1234567890');
    expect(history[0].error).toContain('***REDACTED***');
  });

  it('should detect incomplete (running) executions', () => {
    registry.recordStart({
      id: 'exec-3', taskId: 'task-3', agentName: 'crashed-agent',
    });

    const incomplete = registry.getIncompleteExecutions();
    expect(incomplete).toHaveLength(1);
    expect(incomplete[0].id).toBe('exec-3');
  });

  it('should mark orphaned tasks', () => {
    registry.recordStart({
      id: 'exec-4', taskId: 'task-4', agentName: 'orphaned-agent',
    });

    // Mark as orphaned — use negative offset so cutoff is in the future
    const count = registry.markOrphaned(-1000);
    expect(count).toBe(1);

    const history = registry.getHistory(10);
    expect(history[0].status).toBe('failed');
    expect(history[0].error).toContain('Orphaned');
  });

  it('should return agent stats', () => {
    registry.recordStart({ id: 'e1', taskId: 't1', agentName: 'reviewer' });
    registry.recordComplete('e1', 'ok', 1000);

    registry.recordStart({ id: 'e2', taskId: 't2', agentName: 'reviewer' });
    registry.recordFailure('e2', 'error', 500);

    const stats = registry.getAgentStats('reviewer');
    expect(stats.totalExecutions).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.successRate).toBe(0.5);
  });

  it('should return global stats', () => {
    registry.recordStart({ id: 'e1', taskId: 't1', agentName: 'agent-a', model: 'claude' });
    registry.recordComplete('e1', 'ok', 1000);

    registry.recordStart({ id: 'e2', taskId: 't2', agentName: 'agent-b', model: 'gpt-4' });
    registry.recordComplete('e2', 'ok', 2000);

    const stats = registry.getGlobalStats();
    expect(stats.total).toBe(2);
    expect(stats.completed).toBe(2);
    expect(Object.keys(stats.byAgent)).toHaveLength(2);
    expect(Object.keys(stats.byModel)).toHaveLength(2);
  });

  it('should cleanup old records', () => {
    registry.recordStart({ id: 'e1', taskId: 't1', agentName: 'old-agent' });
    registry.recordComplete('e1', 'old result', 100);

    // Use a large negative offset to ensure the cutoff is in the future
    // cleanup(-1000) means cutoff = Date.now() - (-1000) = Date.now() + 1000 (future)
    const removed = registry.cleanup(-1000);
    expect(removed).toBe(1);
    expect(registry.getHistory()).toHaveLength(0);
  });

  it('should filter history by agent name', () => {
    registry.recordStart({ id: 'e1', taskId: 't1', agentName: 'agent-a' });
    registry.recordComplete('e1', 'ok', 100);

    registry.recordStart({ id: 'e2', taskId: 't2', agentName: 'agent-b' });
    registry.recordComplete('e2', 'ok', 200);

    const historyA = registry.getHistory(10, 'agent-a');
    expect(historyA).toHaveLength(1);
    expect(historyA[0].agentName).toBe('agent-a');
  });

  it('should truncate long prompts and results', () => {
    const longPrompt = 'x'.repeat(5000);
    registry.recordStart({ id: 'e1', taskId: 't1', agentName: 'agent', prompt: longPrompt });
    registry.recordComplete('e1', 'y'.repeat(5000), 100);

    // No error thrown — truncation handled internally
    const history = registry.getHistory(1);
    expect(history).toHaveLength(1);
  });
});
