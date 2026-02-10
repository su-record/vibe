import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';
import { MemoryStorage } from '../../memory/MemoryStorage.js';
import { ReflectionStore } from '../../memory/ReflectionStore.js';
import { InsightStore } from '../InsightStore.js';
import { InsightExtractor } from '../InsightExtractor.js';
import { SkillGapDetector } from '../SkillGapDetector.js';

describe('InsightStore', () => {
  let storage: MemoryStorage;
  let store: InsightStore;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `core-insight-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    store = new InsightStore(storage);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe('Table creation', () => {
    it('should create insights and skill_gaps tables', () => {
      const db = storage.getDatabase();
      const insTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='insights'").get();
      const gapTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='skill_gaps'").get();
      expect(insTable).toBeDefined();
      expect(gapTable).toBeDefined();
    });

    it('should not affect existing tables', () => {
      const db = storage.getDatabase();
      const memTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memories'").get();
      const reflTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reflections'").get();
      expect(memTable).toBeDefined();
      expect(reflTable).toBeDefined();
    });
  });

  describe('save and getById', () => {
    it('should save and retrieve an insight', () => {
      const id = store.save({
        type: 'anti_pattern',
        title: 'console.log in production',
        description: 'Found console.log statements in committed code',
        evidence: ['refl-1', 'refl-2'],
        confidence: 0.7,
        tags: ['code-quality'],
        generatedFrom: 'reflection',
      });

      const insight = store.getById(id);
      expect(insight).not.toBeNull();
      expect(insight!.type).toBe('anti_pattern');
      expect(insight!.title).toBe('console.log in production');
      expect(insight!.evidence).toEqual(['refl-1', 'refl-2']);
      expect(insight!.confidence).toBe(0.7);
      expect(insight!.status).toBe('draft');
      expect(insight!.occurrences).toBe(1);
    });
  });

  describe('findAndMergeDuplicate', () => {
    it('should merge duplicate insights by incrementing occurrences', () => {
      const id1 = store.save({
        type: 'pattern',
        title: 'Use TypeScript strict mode',
        description: 'Always enable strict mode',
        generatedFrom: 'reflection',
      });

      // Save to trigger FTS indexing if available
      const insight1 = store.getById(id1);
      expect(insight1!.occurrences).toBe(1);

      // Try to merge
      const merged = store.findAndMergeDuplicate('Use TypeScript strict mode', 'Always enable strict mode');

      if (storage.isFTS5Available()) {
        expect(merged).toBe(id1);
        const updated = store.getById(id1);
        expect(updated!.occurrences).toBe(2);
      }
    });
  });

  describe('getActionable', () => {
    it('should return confirmed insights of actionable types', () => {
      store.save({ type: 'skill_gap', title: 'Gap 1', description: 'desc', generatedFrom: 'observation' });
      const id = store.save({ type: 'pattern', title: 'Pattern 1', description: 'desc', generatedFrom: 'reflection' });
      store.updateStatus(id, 'confirmed');

      const actionable = store.getActionable();
      expect(actionable.length).toBeGreaterThanOrEqual(1);
      expect(actionable.every(i => i.status === 'confirmed')).toBe(true);
    });
  });

  describe('cleanupLowConfidence', () => {
    it('should remove old low-confidence insights', () => {
      // Save with low confidence
      const id = store.save({
        type: 'pattern',
        title: 'Low confidence',
        description: 'test',
        confidence: 0.1,
        generatedFrom: 'reflection',
      });

      // Manually backdate
      const db = storage.getDatabase();
      db.prepare(`UPDATE insights SET createdAt = ? WHERE id = ?`)
        .run(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), id);

      const removed = store.cleanupLowConfidence();
      expect(removed).toBe(1);
      expect(store.getById(id)).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      store.save({ type: 'pattern', title: 'P1', description: 'd', generatedFrom: 'reflection' });
      store.save({ type: 'anti_pattern', title: 'AP1', description: 'd', generatedFrom: 'reflection' });
      store.save({ type: 'pattern', title: 'P2', description: 'd', generatedFrom: 'observation' });

      const stats = store.getStats();
      expect(stats.total).toBe(3);
      expect(stats.byType['pattern']).toBe(2);
      expect(stats.byType['anti_pattern']).toBe(1);
      expect(stats.byStatus['draft']).toBe(3);
    });
  });
});

describe('InsightExtractor', () => {
  let storage: MemoryStorage;
  let extractor: InsightExtractor;
  let reflectionStore: ReflectionStore;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `core-extract-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    // Need to create InsightStore first to ensure tables exist
    new InsightStore(storage);
    extractor = new InsightExtractor(storage);
    reflectionStore = new ReflectionStore(storage);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('should extract patterns from 3+ repeated observations', () => {
    // Create 3 reflections with same topic
    for (let i = 0; i < 3; i++) {
      reflectionStore.save({
        type: 'minor',
        trigger: 'manual',
        insights: ['TypeScript any type usage detected'],
        score: 0.5,
      });
    }

    const result = extractor.extractFromRecent();
    expect(result.newInsights.length).toBeGreaterThanOrEqual(1);
  });

  it('should skip topics with fewer than 3 occurrences', () => {
    reflectionStore.save({ type: 'minor', trigger: 'manual', insights: ['unique topic abc'] });

    const result = extractor.extractFromRecent();
    expect(result.skippedCount).toBeGreaterThan(0);
  });

  it('should handle invalid data gracefully', () => {
    // Even with no data, should not throw
    const result = extractor.extractFromRecent();
    expect(result.errorCount).toBe(0);
  });
});

describe('SkillGapDetector', () => {
  let storage: MemoryStorage;
  let detector: SkillGapDetector;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `core-gap-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    new InsightStore(storage); // Ensure tables exist
    detector = new SkillGapDetector(storage);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('should log a miss', () => {
    detector.logMiss('CSV 파일 분석해줘');
    expect(detector.getGapCount()).toBe(1);
  });

  it('should detect gaps from 3+ similar misses', () => {
    for (let i = 0; i < 3; i++) {
      detector.logMiss('CSV 분석');
    }

    const result = detector.analyze();
    expect(result.newGaps.length).toBeGreaterThanOrEqual(1);
  });

  it('should not create gap for fewer than 3 misses', () => {
    detector.logMiss('unique prompt xyz');
    detector.logMiss('another unique prompt');

    const result = detector.analyze();
    expect(result.newGaps).toHaveLength(0);
  });
});
