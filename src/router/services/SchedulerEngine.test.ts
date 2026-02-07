/**
 * SchedulerEngine Tests
 * Cron registration, natural language conversion, CRUD
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { SchedulerEngine } from './SchedulerEngine.js';
import { SmartRouterLike } from '../types.js';

const mockLogger = vi.fn();

function createMockRouter(cronResponse: string = '0 9 * * *'): SmartRouterLike {
  return {
    route: vi.fn().mockResolvedValue({ success: true, content: cronResponse }),
  } as unknown as SmartRouterLike;
}

function createTempDbPath(): string {
  const dir = path.join(os.tmpdir(), `vibe-sched-test-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'schedules-test.db');
}

describe('SchedulerEngine', () => {
  let engine: SchedulerEngine;
  let dbPath: string;
  let mockRouter: SmartRouterLike;

  beforeEach(() => {
    mockLogger.mockClear();
    dbPath = createTempDbPath();
    mockRouter = createMockRouter();
    engine = new SchedulerEngine(mockLogger, mockRouter, dbPath);
  });

  afterEach(async () => {
    await engine.shutdown();
    try { fs.rmSync(path.dirname(dbPath), { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe('createWithCron', () => {
    it('should create a schedule and return job', () => {
      const job = engine.createWithCron('테스트', '0 9 * * *', 'AI 뉴스 검색');
      expect(job.id).toBe(1);
      expect(job.name).toBe('테스트');
      expect(job.cron).toBe('0 9 * * *');
      expect(job.action).toBe('AI 뉴스 검색');
      expect(job.enabled).toBeTruthy();
    });
  });

  describe('list', () => {
    it('should list all schedules', () => {
      engine.createWithCron('작업1', '0 9 * * *', 'action1');
      engine.createWithCron('작업2', '0 10 * * 1', 'action2');
      const list = engine.list();
      expect(list).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('should delete a schedule', () => {
      const job = engine.createWithCron('삭제할 작업', '0 9 * * *', 'action');
      expect(engine.delete(job.id)).toBe(true);
      expect(engine.list()).toHaveLength(0);
    });

    it('should return false for non-existent schedule', () => {
      expect(engine.delete(999)).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should toggle schedule enabled state', () => {
      const job = engine.createWithCron('토글', '0 9 * * *', 'action');
      const toggled = engine.toggle(job.id);
      expect(toggled).not.toBeNull();
      expect(toggled!.enabled).toBeFalsy();
    });
  });

  describe('naturalToCron', () => {
    it('should quick-parse "매일 9시"', async () => {
      const cron = await engine.naturalToCron('매일 9시');
      expect(cron).toBe('0 9 * * *');
    });

    it('should quick-parse "매시간"', async () => {
      const cron = await engine.naturalToCron('매시간');
      expect(cron).toBe('0 * * * *');
    });

    it('should quick-parse "매주 월요일 10시"', async () => {
      const cron = await engine.naturalToCron('매주 월요일 10시');
      expect(cron).toBe('0 10 * * 1');
    });

    it('should use LLM for complex expressions', async () => {
      mockRouter = createMockRouter('30 14 * * 5');
      engine = new SchedulerEngine(mockLogger, mockRouter, dbPath);
      const cron = await engine.naturalToCron('매주 금요일 오후 2시 30분');
      expect(cron).toBe('30 14 * * 5');
    });
  });

  describe('create', () => {
    it('should create schedule from natural language', async () => {
      const job = await engine.create('뉴스', '매일 9시', 'AI 뉴스 검색');
      expect(job.cron).toBe('0 9 * * *');
      expect(job.name).toBe('뉴스');
    });
  });
});
