/**
 * MonitorRoute Tests
 * Schedule CRUD, report generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { MonitorRoute } from './MonitorRoute.js';
import { SmartRouterLike, ClassifiedIntent, RouteContext, RouteJob, RouteServices } from '../types.js';
import { SchedulerEngine } from '../services/SchedulerEngine.js';
import { DailyReportGenerator } from '../services/DailyReportGenerator.js';

const mockLogger = vi.fn();

function createMockRouter(content: string = 'mock'): SmartRouterLike {
  return {
    route: vi.fn().mockResolvedValue({ success: true, content }),
  } as unknown as SmartRouterLike;
}

function createContext(query: string): RouteContext {
  const mockRouterObj = {
    handleMessage: vi.fn(),
    getSmartRouter: vi.fn().mockReturnValue({ route: vi.fn().mockResolvedValue({ content: 'ok', success: true }) }),
  };
  return {
    job: { id: 'job-1', status: 'executing', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as RouteJob,
    intent: { category: 'monitor', rawQuery: query, confidence: 0.9 } as ClassifiedIntent,
    message: { id: 'msg-1', channel: 'telegram', chatId: 'chat-1', userId: 'user-1', content: query, type: 'text', metadata: {}, timestamp: new Date().toISOString() },
    chatId: 'chat-1',
    userId: 'user-1',
    services: {
      logger: mockLogger, sendTelegram: vi.fn(), sendTelegramInlineKeyboard: vi.fn(), router: mockRouterObj,
      config: { repos: { aliases: {}, basePaths: [] }, qa: { autoApproveTools: [], maxWaitSeconds: 60, readOnTimeout: 'approve', writeOnTimeout: 'deny' }, notifications: { quietHoursStart: 23, quietHoursEnd: 7, minIntervalMs: 10000 } },
    } as RouteServices,
  };
}

describe('MonitorRoute', () => {
  let route: MonitorRoute;
  let mockRouter: SmartRouterLike;
  let scheduler: SchedulerEngine;
  let dbPath: string;

  beforeEach(() => {
    mockLogger.mockClear();
    mockRouter = createMockRouter('요약 결과입니다.');
    dbPath = path.join(os.tmpdir(), `vibe-mon-test-${Date.now()}`, 'sched.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    scheduler = new SchedulerEngine(mockLogger, mockRouter, dbPath);
    const reportGen = new DailyReportGenerator(mockLogger, mockRouter);
    route = new MonitorRoute(mockLogger, mockRouter, scheduler, reportGen);
  });

  afterEach(async () => {
    await scheduler.shutdown();
    try { fs.rmSync(path.dirname(dbPath), { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe('canHandle', () => {
    it('should handle monitor category', () => {
      expect(route.canHandle({ category: 'monitor', rawQuery: '', confidence: 0.9 } as ClassifiedIntent)).toBe(true);
    });
  });

  describe('execute - schedule_create', () => {
    it('should create a schedule from natural language', async () => {
      const result = await route.execute(createContext('매일 9시에 AI 뉴스 검색'));
      expect(result.success).toBe(true);
      expect(result.data).toContain('스케줄 등록됨');
    });
  });

  describe('execute - schedule_list', () => {
    it('should list schedules', async () => {
      scheduler.createWithCron('테스트', '0 9 * * *', 'test action');
      const result = await route.execute(createContext('스케줄 목록'));
      expect(result.success).toBe(true);
      expect(result.data).toContain('테스트');
    });

    it('should show empty message when no schedules', async () => {
      const result = await route.execute(createContext('스케줄 목록'));
      expect(result.success).toBe(true);
      expect(result.data).toContain('없습니다');
    });
  });

  describe('execute - schedule_delete', () => {
    it('should delete a schedule by id', async () => {
      scheduler.createWithCron('삭제할 작업', '0 9 * * *', 'action');
      const result = await route.execute(createContext('스케줄 삭제 1'));
      expect(result.success).toBe(true);
      expect(result.data).toContain('삭제됨');
    });
  });

  describe('execute - report_now', () => {
    it('should generate a report', async () => {
      const result = await route.execute(createContext('리포트'));
      expect(result.success).toBe(true);
      expect(result.data).toContain('일일 리포트');
    });
  });
});
