/**
 * AgentAnnouncer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentAnnouncer } from './AgentAnnouncer.js';

describe('AgentAnnouncer', () => {
  let announcer: AgentAnnouncer;

  beforeEach(() => {
    announcer = new AgentAnnouncer();
  });

  it('should emit agent-start event and track stats', () => {
    let emitted = false;
    announcer.on('agent-start', () => { emitted = true; });

    announcer.announceStart({
      taskId: 'task-1', agentName: 'test-agent',
      model: 'claude-sonnet-4-5', prompt: 'Test prompt', timestamp: Date.now(),
    });

    expect(emitted).toBe(true);
    expect(announcer.getStats().totalLaunched).toBe(1);
  });

  it('should emit agent-complete event and update stats', () => {
    let emitted = false;
    announcer.on('agent-complete', () => { emitted = true; });

    announcer.announceComplete({
      taskId: 'task-1', agentName: 'test-agent', success: true,
      duration: 1000, model: 'claude-sonnet-4-5',
      resultSummary: 'Done', timestamp: Date.now(),
    });

    expect(emitted).toBe(true);
    const stats = announcer.getStats();
    expect(stats.totalCompleted).toBe(1);
    expect(stats.avgDuration).toBe(1000);
  });

  it('should emit agent-error event and update stats', () => {
    let emitted = false;
    announcer.on('agent-error', () => { emitted = true; });

    announcer.announceError({
      taskId: 'task-1', agentName: 'test-agent',
      error: 'Something failed', retryable: true,
      duration: 500, timestamp: Date.now(),
    });

    expect(emitted).toBe(true);
    expect(announcer.getStats().totalFailed).toBe(1);
  });

  it('should truncate prompt and resultSummary', () => {
    const longPrompt = 'x'.repeat(300);
    const longResult = 'y'.repeat(600);

    announcer.announceStart({
      taskId: 'task-1', agentName: 'test', model: 'claude',
      prompt: longPrompt, timestamp: Date.now(),
    });

    announcer.announceComplete({
      taskId: 'task-1', agentName: 'test', success: true,
      duration: 100, model: 'claude',
      resultSummary: longResult, timestamp: Date.now(),
    });

    const history = announcer.getRecentHistory(2);
    expect(history).toHaveLength(2);
    // Start event prompt should be truncated to 200 + '...'
    const startEvent = history[0] as { prompt: string };
    expect(startEvent.prompt.length).toBeLessThanOrEqual(203);
  });

  it('should enforce max history of 100 items (FIFO)', () => {
    for (let i = 0; i < 110; i++) {
      announcer.announceStart({
        taskId: `task-${i}`, agentName: 'agent', model: 'claude',
        prompt: 'test', timestamp: Date.now(),
      });
    }

    const all = announcer.getRecentHistory(200);
    expect(all.length).toBe(100);
    // First item should be task-10 (first 10 were evicted)
    expect((all[0] as { taskId: string }).taskId).toBe('task-10');
  });

  it('should track byModel and byAgent stats', () => {
    announcer.announceStart({
      taskId: 'task-1', agentName: 'reviewer', model: 'gpt-4',
      prompt: 'review', timestamp: Date.now(),
    });
    announcer.announceComplete({
      taskId: 'task-1', agentName: 'reviewer', success: true,
      duration: 2000, model: 'gpt-4', resultSummary: 'ok', timestamp: Date.now(),
    });

    const stats = announcer.getStats();
    expect(stats.byModel['gpt-4']).toBeDefined();
    expect(stats.byModel['gpt-4'].count).toBe(2); // start + complete
    expect(stats.byAgent['reviewer']).toBeDefined();
    expect(stats.byAgent['reviewer'].count).toBe(1);
  });

  it('should format status lines correctly', () => {
    const startLine = announcer.formatStatusLine({
      taskId: 'task-1', agentName: 'agent', model: 'claude',
      prompt: 'test', timestamp: Date.now(),
    });
    expect(startLine).toContain('[START]');

    const completeLine = announcer.formatStatusLine({
      taskId: 'task-1', agentName: 'agent', success: true,
      duration: 1500, model: 'claude', resultSummary: 'done', timestamp: Date.now(),
    });
    expect(completeLine).toContain('[OK]');
    expect(completeLine).toContain('1500ms');

    const errorLine = announcer.formatStatusLine({
      taskId: 'task-1', agentName: 'agent', error: 'timeout',
      retryable: true, duration: 500, timestamp: Date.now(),
    });
    expect(errorLine).toContain('[ERR]');
  });

  it('should reset stats correctly', () => {
    announcer.announceStart({
      taskId: 'task-1', agentName: 'agent', model: 'claude',
      prompt: 'test', timestamp: Date.now(),
    });

    announcer.resetStats();

    const stats = announcer.getStats();
    expect(stats.totalLaunched).toBe(0);
    expect(announcer.getRecentHistory()).toHaveLength(0);
  });
});
