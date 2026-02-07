/**
 * GitHubMonitor Tests
 * Event filtering, notification formatting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubMonitor, GitHubEvent } from './GitHubMonitor.js';
import { NotificationManager } from '../notifications/NotificationManager.js';

const mockLogger = vi.fn();

function createMockNotificationMgr(): NotificationManager {
  return {
    send: vi.fn().mockResolvedValue(true),
    setSendFunction: vi.fn(),
    sendCompletion: vi.fn().mockResolvedValue(true),
    startBatchTimer: vi.fn(),
    stop: vi.fn(),
  } as unknown as NotificationManager;
}

function createEvent(type: string, action: string, payload: Record<string, unknown> = {}): GitHubEvent {
  return {
    type,
    action,
    repository: { full_name: 'user/repo' },
    payload,
  };
}

describe('GitHubMonitor', () => {
  let monitor: GitHubMonitor;
  let mockNotif: NotificationManager;

  beforeEach(() => {
    mockLogger.mockClear();
    mockNotif = createMockNotificationMgr();
    monitor = new GitHubMonitor(mockLogger, mockNotif, 'chat-1', {
      repos: ['user/repo'],
      events: ['workflow_run.completed', 'pull_request.review_requested'],
    });
  });

  describe('isMonitoredRepo', () => {
    it('should match monitored repo', () => {
      expect(monitor.isMonitoredRepo('user/repo')).toBe(true);
    });

    it('should not match unmonitored repo', () => {
      expect(monitor.isMonitoredRepo('other/repo')).toBe(false);
    });

    it('should monitor all repos when list is empty', () => {
      const m = new GitHubMonitor(mockLogger, mockNotif, 'chat-1', { repos: [] });
      expect(m.isMonitoredRepo('any/repo')).toBe(true);
    });
  });

  describe('isMonitoredEvent', () => {
    it('should match monitored event', () => {
      expect(monitor.isMonitoredEvent('workflow_run.completed')).toBe(true);
    });

    it('should not match unmonitored event', () => {
      expect(monitor.isMonitoredEvent('issues.opened')).toBe(false);
    });
  });

  describe('formatNotification', () => {
    it('should format CI failure', () => {
      const event = createEvent('workflow_run', 'completed', {
        conclusion: 'failure',
        name: 'CI',
        head_commit: { message: 'fix: broken test' },
      });
      const msg = monitor.formatNotification(event, 'workflow_run.completed');
      expect(msg).toContain('[user/repo] CI 실패');
      expect(msg).toContain('fix: broken test');
    });

    it('should return null for successful CI', () => {
      const event = createEvent('workflow_run', 'completed', {
        conclusion: 'success',
        name: 'CI',
      });
      const msg = monitor.formatNotification(event, 'workflow_run.completed');
      expect(msg).toBeNull();
    });

    it('should format PR review request', () => {
      const event = createEvent('pull_request', 'review_requested', {
        pull_request: { number: 42, title: 'Add feature' },
      });
      const msg = monitor.formatNotification(event, 'pull_request.review_requested');
      expect(msg).toContain('PR #42 리뷰 요청');
      expect(msg).toContain('Add feature');
    });
  });

  describe('processEvent', () => {
    it('should send notification for CI failure', async () => {
      const event = createEvent('workflow_run', 'completed', {
        conclusion: 'failure',
        name: 'CI',
        head_commit: { message: 'bad commit' },
      });
      const sent = await monitor.processEvent(event);
      expect(sent).toBe(true);
      expect(mockNotif.send).toHaveBeenCalledWith('chat-1', expect.any(String), 'urgent');
    });

    it('should skip unmonitored repo', async () => {
      const event = createEvent('workflow_run', 'completed', { conclusion: 'failure' });
      event.repository.full_name = 'other/repo';
      const sent = await monitor.processEvent(event);
      expect(sent).toBe(false);
    });
  });
});
