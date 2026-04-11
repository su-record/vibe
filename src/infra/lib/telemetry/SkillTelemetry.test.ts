import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { createTempDir, cleanupTempDir, parseJsonl } from '../../../test-helpers/index.js';
import { SkillTelemetry, SkillEvent } from './SkillTelemetry.js';
import { createSpan, completeSpan } from './VibeSpan.js';

describe('SkillTelemetry', () => {
  let telemetry: SkillTelemetry;
  let testDir: string;

  beforeEach(() => {
    testDir = createTempDir('telemetry-test');
    telemetry = new SkillTelemetry(testDir);
  });

  afterEach(() => {
    cleanupTempDir(testDir);
  });

  describe('log', () => {
    it('should create JSONL log file on first write', () => {
      telemetry.logSuccess('vibe.run', 12.5, '2.7.17');

      expect(existsSync(telemetry.getLogPath())).toBe(true);
    });

    it('should append events as JSONL', () => {
      telemetry.logSuccess('vibe.run', 12.5, '2.7.17');
      telemetry.logError('vibe-spec', 3.2, '2.7.17');

      const content = readFileSync(telemetry.getLogPath(), 'utf-8');
      const events = parseJsonl<SkillEvent>(content);

      expect(events).toHaveLength(2);
      expect(events[0].skill).toBe('vibe.run');
      expect(events[0].outcome).toBe('success');
      expect(events[0].v).toBe(1);
      expect(events[0].os).toBe(process.platform);
      expect(events[1].skill).toBe('vibe-spec');
      expect(events[1].outcome).toBe('error');
    });

    it('should include ISO timestamp', () => {
      telemetry.logSuccess('vibe.trace', null, '2.7.17');

      const events = telemetry.readAll();
      expect(events[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('readAll', () => {
    it('should return empty array for missing file', () => {
      const fresh = new SkillTelemetry(createTempDir('empty'));
      expect(fresh.readAll()).toEqual([]);
    });

    it('should return all logged events', () => {
      telemetry.logSuccess('a', 1, '1.0.0');
      telemetry.logSuccess('b', 2, '1.0.0');
      telemetry.logError('c', null, '1.0.0');

      const events = telemetry.readAll();
      expect(events).toHaveLength(3);
    });
  });

  describe('summarize', () => {
    it('should aggregate by skill name', () => {
      telemetry.logSuccess('vibe.run', 10, '1.0.0');
      telemetry.logSuccess('vibe.run', 20, '1.0.0');
      telemetry.logError('vibe.run', 5, '1.0.0');
      telemetry.logSuccess('vibe-spec', 3, '1.0.0');

      const summary = telemetry.summarize();

      expect(summary).toHaveLength(2);

      const vibeRun = summary.find(s => s.skill === 'vibe.run');
      expect(vibeRun?.count).toBe(3);
      expect(vibeRun?.successCount).toBe(2);
      expect(vibeRun?.errorCount).toBe(1);
      expect(vibeRun?.avgDurationS).toBeCloseTo(11.7, 0);

      const vibeSpec = summary.find(s => s.skill === 'vibe-spec');
      expect(vibeSpec?.count).toBe(1);
    });

    it('should sort by count descending', () => {
      telemetry.logSuccess('rare', 1, '1.0.0');
      telemetry.logSuccess('common', 1, '1.0.0');
      telemetry.logSuccess('common', 1, '1.0.0');
      telemetry.logSuccess('common', 1, '1.0.0');

      const summary = telemetry.summarize();
      expect(summary[0].skill).toBe('common');
      expect(summary[1].skill).toBe('rare');
    });

    it('should handle null durations', () => {
      telemetry.logSuccess('no-duration', null, '1.0.0');

      const summary = telemetry.summarize();
      expect(summary[0].avgDurationS).toBeNull();
    });
  });

  describe('disabled mode', () => {
    it('should not write when disabled', () => {
      const disabled = new SkillTelemetry(testDir, false);
      disabled.logSuccess('should-not-log', 1, '1.0.0');

      expect(existsSync(disabled.getLogPath())).toBe(false);
    });
  });

  describe('spans', () => {
    it('should log and read spans', () => {
      const span = createSpan('skill_run', 'vibe.run', { skill: 'vibe.run' });
      const completed = completeSpan(span, 'ok', 1500);
      telemetry.logSpan(completed);

      const spans = telemetry.readSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0].v).toBe(2);
      expect(spans[0].type).toBe('skill_run');
      expect(spans[0].name).toBe('vibe.run');
      expect(spans[0].duration_ms).toBe(1500);
      expect(spans[0].status).toBe('ok');
    });

    it('should support parent spans', () => {
      const parent = createSpan('agent_run', 'explorer');
      const child = createSpan('llm_call', 'claude-haiku', {}, parent.id);
      telemetry.logSpan(parent);
      telemetry.logSpan(child);

      const spans = telemetry.readSpans();
      expect(spans).toHaveLength(2);
      expect(spans[1].parent_id).toBe(spans[0].id);
    });

    it('should return empty array for missing span file', () => {
      expect(telemetry.readSpans()).toEqual([]);
    });

    it('should not write spans when disabled', () => {
      const disabled = new SkillTelemetry(testDir, false);
      const span = createSpan('build', 'tsc');
      disabled.logSpan(span);
      expect(disabled.readSpans()).toEqual([]);
    });
  });
});
