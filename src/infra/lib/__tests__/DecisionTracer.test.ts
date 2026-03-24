import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { createTempDir, cleanupTempDir, parseJsonl } from '../../../test-helpers/index.js';
import { DecisionTracer } from '../DecisionTracer.js';
import type { DecisionRecord } from '../DecisionTracer.js';

describe('DecisionTracer', () => {
  let tracer: DecisionTracer;
  let testDir: string;

  beforeEach(() => {
    testDir = createTempDir('decision-tracer-test');
    tracer = new DecisionTracer(testDir);
  });

  afterEach(() => {
    cleanupTempDir(testDir);
  });

  // ─── record ───

  describe('record', () => {
    it('should create JSONL log file on first write', () => {
      tracer.record({ category: 'architecture', decision: 'use ESM', rationale: 'modern standard' });
      expect(existsSync(tracer.getLogPath())).toBe(true);
    });

    it('should return a record with all required fields', () => {
      const record = tracer.record({
        category: 'implementation',
        decision: 'use Map over object',
        rationale: 'O(1) lookups',
        alternatives: ['plain object', 'array'],
        context: { feature: 'cache', files: ['src/cache.ts'], phase: '1' },
      });

      expect(record.v).toBe(1);
      expect(typeof record.id).toBe('string');
      expect(record.id.length).toBeGreaterThan(0);
      expect(record.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(record.category).toBe('implementation');
      expect(record.decision).toBe('use Map over object');
      expect(record.rationale).toBe('O(1) lookups');
      expect(record.alternatives).toEqual(['plain object', 'array']);
      expect(record.context.feature).toBe('cache');
      expect(record.context.files).toEqual(['src/cache.ts']);
      expect(record.outcome).toBeUndefined();
    });

    it('should default alternatives to empty array', () => {
      const record = tracer.record({ category: 'retry', decision: 'retry once', rationale: 'transient error' });
      expect(record.alternatives).toEqual([]);
    });

    it('should default context.files to empty array', () => {
      const record = tracer.record({ category: 'fix_strategy', decision: 'patch', rationale: 'minimal diff' });
      expect(record.context.files).toEqual([]);
    });

    it('should append each record as a separate JSONL line', () => {
      tracer.record({ category: 'architecture', decision: 'A', rationale: 'r1' });
      tracer.record({ category: 'implementation', decision: 'B', rationale: 'r2' });

      const content = readFileSync(tracer.getLogPath(), 'utf-8');
      const parsed = parseJsonl<DecisionRecord>(content);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].decision).toBe('A');
      expect(parsed[1].decision).toBe('B');
    });

    it('should generate unique IDs for each record', () => {
      const r1 = tracer.record({ category: 'architecture', decision: 'X', rationale: 'r' });
      const r2 = tracer.record({ category: 'architecture', decision: 'Y', rationale: 'r' });
      expect(r1.id).not.toBe(r2.id);
    });
  });

  // ─── readAll ───

  describe('readAll', () => {
    it('should return empty array when file does not exist', () => {
      const fresh = new DecisionTracer(createTempDir('empty'));
      expect(fresh.readAll()).toEqual([]);
    });

    it('should return all logged records', () => {
      tracer.record({ category: 'architecture', decision: '1', rationale: 'r' });
      tracer.record({ category: 'implementation', decision: '2', rationale: 'r' });
      tracer.record({ category: 'retry', decision: '3', rationale: 'r' });

      const all = tracer.readAll();
      expect(all).toHaveLength(3);
    });

    it('should handle corrupt/empty lines gracefully', () => {
      tracer.record({ category: 'architecture', decision: 'valid', rationale: 'r' });
      // inject a corrupt line
      writeFileSync(tracer.getLogPath(), readFileSync(tracer.getLogPath(), 'utf-8') + 'NOT_JSON\n');

      const all = tracer.readAll();
      expect(all).toHaveLength(1);
      expect(all[0].decision).toBe('valid');
    });

    it('should return empty array for completely corrupt file', () => {
      writeFileSync(tracer.getLogPath(), 'BAD_JSON\nALSO_BAD\n');
      expect(tracer.readAll()).toEqual([]);
    });
  });

  // ─── updateOutcome ───

  describe('updateOutcome', () => {
    it('should update a decision with outcome', () => {
      const record = tracer.record({ category: 'fix_strategy', decision: 'patch X', rationale: 'minimal' });

      const updated = tracer.updateOutcome(record.id, { success: true, impact: 'bug resolved' });
      expect(updated).toBe(true);

      const all = tracer.readAll();
      const found = all.find(r => r.id === record.id);
      expect(found?.outcome?.success).toBe(true);
      expect(found?.outcome?.impact).toBe('bug resolved');
      expect(found?.outcome?.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should return false for unknown decision ID', () => {
      const updated = tracer.updateOutcome('nonexistent-id', { success: false, impact: 'n/a' });
      expect(updated).toBe(false);
    });

    it('should preserve other records when updating one', () => {
      const r1 = tracer.record({ category: 'architecture', decision: 'A', rationale: 'r' });
      const r2 = tracer.record({ category: 'implementation', decision: 'B', rationale: 'r' });

      tracer.updateOutcome(r1.id, { success: true, impact: 'good' });

      const all = tracer.readAll();
      expect(all).toHaveLength(2);
      expect(all.find(r => r.id === r2.id)?.outcome).toBeUndefined();
    });

    it('should record outcome timestamp', () => {
      const record = tracer.record({ category: 'verification', decision: 'run tests', rationale: 'correctness' });
      const before = new Date().toISOString();
      tracer.updateOutcome(record.id, { success: true, impact: 'passed' });
      const after = new Date().toISOString();

      const found = tracer.readAll().find(r => r.id === record.id);
      const recordedAt = found?.outcome?.recordedAt ?? '';
      expect(recordedAt >= before).toBe(true);
      expect(recordedAt <= after).toBe(true);
    });
  });

  // ─── queryByCategory ───

  describe('queryByCategory', () => {
    beforeEach(() => {
      tracer.record({ category: 'architecture', decision: 'A1', rationale: 'r' });
      tracer.record({ category: 'architecture', decision: 'A2', rationale: 'r' });
      tracer.record({ category: 'implementation', decision: 'I1', rationale: 'r' });
      tracer.record({ category: 'fix_strategy', decision: 'F1', rationale: 'r' });
    });

    it('should return only records of the given category', () => {
      const arch = tracer.queryByCategory('architecture');
      expect(arch).toHaveLength(2);
      for (const r of arch) {
        expect(r.category).toBe('architecture');
      }
    });

    it('should return empty array for category with no records', () => {
      const retry = tracer.queryByCategory('retry');
      expect(retry).toEqual([]);
    });

    it('should filter implementation correctly', () => {
      const impl = tracer.queryByCategory('implementation');
      expect(impl).toHaveLength(1);
      expect(impl[0].decision).toBe('I1');
    });
  });

  // ─── queryByFeature ───

  describe('queryByFeature', () => {
    beforeEach(() => {
      tracer.record({ category: 'architecture', decision: 'A', rationale: 'r', context: { feature: 'auth' } });
      tracer.record({ category: 'implementation', decision: 'B', rationale: 'r', context: { feature: 'auth' } });
      tracer.record({ category: 'implementation', decision: 'C', rationale: 'r', context: { feature: 'cache' } });
      tracer.record({ category: 'retry', decision: 'D', rationale: 'r' });
    });

    it('should return records for a specific feature', () => {
      const auth = tracer.queryByFeature('auth');
      expect(auth).toHaveLength(2);
      for (const r of auth) {
        expect(r.context.feature).toBe('auth');
      }
    });

    it('should return empty array for unknown feature', () => {
      expect(tracer.queryByFeature('payments')).toEqual([]);
    });

    it('should not include records without a feature', () => {
      const cache = tracer.queryByFeature('cache');
      expect(cache).toHaveLength(1);
    });
  });

  // ─── getRecent ───

  describe('getRecent', () => {
    it('should return the last N records in insertion order', () => {
      for (let i = 0; i < 5; i++) {
        tracer.record({ category: 'implementation', decision: `decision-${i}`, rationale: 'r' });
      }

      const recent = tracer.getRecent(3);
      expect(recent).toHaveLength(3);
      expect(recent[0].decision).toBe('decision-2');
      expect(recent[1].decision).toBe('decision-3');
      expect(recent[2].decision).toBe('decision-4');
    });

    it('should return all when count exceeds total records', () => {
      tracer.record({ category: 'architecture', decision: 'only one', rationale: 'r' });
      expect(tracer.getRecent(10)).toHaveLength(1);
    });

    it('should return empty array on empty log', () => {
      expect(tracer.getRecent(5)).toEqual([]);
    });

    it('should handle count of 0', () => {
      tracer.record({ category: 'architecture', decision: 'X', rationale: 'r' });
      expect(tracer.getRecent(0)).toEqual([]);
    });
  });

  // ─── summarizeFeature ───

  describe('summarizeFeature', () => {
    it('should return zero totals for unknown feature', () => {
      const summary = tracer.summarizeFeature('unknown');
      expect(summary.feature).toBe('unknown');
      expect(summary.totalDecisions).toBe(0);
      expect(summary.byCategory).toEqual({});
      expect(summary.successRate).toBeNull();
      expect(summary.decisions).toEqual([]);
    });

    it('should aggregate by category', () => {
      tracer.record({ category: 'architecture', decision: 'A', rationale: 'r', context: { feature: 'feat1' } });
      tracer.record({ category: 'architecture', decision: 'B', rationale: 'r', context: { feature: 'feat1' } });
      tracer.record({ category: 'implementation', decision: 'C', rationale: 'r', context: { feature: 'feat1' } });

      const summary = tracer.summarizeFeature('feat1');
      expect(summary.totalDecisions).toBe(3);
      expect(summary.byCategory['architecture']).toBe(2);
      expect(summary.byCategory['implementation']).toBe(1);
    });

    it('should compute successRate from decisions with outcomes', () => {
      const r1 = tracer.record({ category: 'fix_strategy', decision: 'X', rationale: 'r', context: { feature: 'f' } });
      const r2 = tracer.record({ category: 'fix_strategy', decision: 'Y', rationale: 'r', context: { feature: 'f' } });
      tracer.record({ category: 'fix_strategy', decision: 'Z', rationale: 'r', context: { feature: 'f' } });

      tracer.updateOutcome(r1.id, { success: true, impact: 'good' });
      tracer.updateOutcome(r2.id, { success: false, impact: 'bad' });

      const summary = tracer.summarizeFeature('f');
      expect(summary.successRate).toBeCloseTo(0.5, 5);
    });

    it('should return null successRate when no outcomes recorded', () => {
      tracer.record({ category: 'architecture', decision: 'A', rationale: 'r', context: { feature: 'f2' } });
      const summary = tracer.summarizeFeature('f2');
      expect(summary.successRate).toBeNull();
    });

    it('should return 1.0 when all outcomes are successful', () => {
      const r = tracer.record({ category: 'verification', decision: 'V', rationale: 'r', context: { feature: 'g' } });
      tracer.updateOutcome(r.id, { success: true, impact: 'all good' });
      expect(tracer.summarizeFeature('g').successRate).toBe(1);
    });

    it('should include all decisions in the summary', () => {
      tracer.record({ category: 'architecture', decision: 'A', rationale: 'r', context: { feature: 'h' } });
      tracer.record({ category: 'implementation', decision: 'B', rationale: 'r', context: { feature: 'h' } });

      const summary = tracer.summarizeFeature('h');
      expect(summary.decisions).toHaveLength(2);
    });
  });

  // ─── disabled mode ───

  describe('disabled mode', () => {
    it('should not write file when disabled', () => {
      const disabled = new DecisionTracer(testDir, false);
      disabled.record({ category: 'architecture', decision: 'should not persist', rationale: 'r' });
      expect(existsSync(disabled.getLogPath())).toBe(false);
    });

    it('should still return a valid record object when disabled', () => {
      const disabled = new DecisionTracer(testDir, false);
      const record = disabled.record({ category: 'architecture', decision: 'X', rationale: 'r' });
      expect(record.v).toBe(1);
      expect(typeof record.id).toBe('string');
    });

    it('should return false from updateOutcome when disabled', () => {
      const disabled = new DecisionTracer(testDir, false);
      expect(disabled.updateOutcome('any-id', { success: true, impact: 'n/a' })).toBe(false);
    });

    it('should return empty array from readAll when disabled', () => {
      const disabled = new DecisionTracer(testDir, false);
      expect(disabled.readAll()).toEqual([]);
    });
  });

  // ─── getLogPath ───

  describe('getLogPath', () => {
    it('should end with decisions.jsonl', () => {
      expect(tracer.getLogPath()).toMatch(/decisions\.jsonl$/);
    });

    it('should be inside the provided analytics directory', () => {
      expect(tracer.getLogPath()).toContain(testDir);
    });
  });
});
