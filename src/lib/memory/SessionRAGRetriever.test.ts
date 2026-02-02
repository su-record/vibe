import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStorage } from './MemoryStorage.js';
import { SessionRAGStore } from './SessionRAGStore.js';
import { SessionRAGRetriever } from './SessionRAGRetriever.js';
import { rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SessionRAGRetriever', () => {
  let storage: MemoryStorage;
  let store: SessionRAGStore;
  let retriever: SessionRAGRetriever;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `vibe-srag-ret-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    store = new SessionRAGStore(storage);
    retriever = new SessionRAGRetriever(storage, store);

    // Seed data
    store.addDecision({
      title: 'Use Vitest for testing',
      rationale: 'Fast and modern test runner',
      priority: 2,
      tags: ['testing'],
    });
    store.addDecision({
      title: 'Use React for frontend',
      rationale: 'Component-based architecture',
      priority: 1,
    });
    store.addConstraint({
      title: 'No vector database dependencies',
      type: 'technical',
      severity: 'high',
    });
    store.addConstraint({
      title: 'Budget limit $5000',
      type: 'business',
      severity: 'medium',
    });
    store.addGoal({
      title: 'Implement Session RAG system',
      priority: 2,
      progressPercent: 50,
    });
    store.addGoal({
      title: 'Add login feature',
      priority: 1,
      progressPercent: 0,
    });
    store.addEvidence({
      type: 'test',
      title: 'Unit tests passing',
      status: 'pass',
      metrics: { coverage: 85 },
    });
    store.addEvidence({
      type: 'build',
      title: 'Build failed with type errors',
      status: 'fail',
    });
  });

  afterEach(() => {
    storage.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('retrieve', () => {
    it('should return results with scores', () => {
      const result = retriever.retrieve({ query: 'testing' });

      expect(result.queryTime).toBeGreaterThanOrEqual(0);
      expect(result.decisions.length).toBeGreaterThanOrEqual(1);
      expect(result.decisions[0].score).toBeGreaterThan(0);
      expect(result.decisions[0].breakdown).toHaveProperty('bm25');
      expect(result.decisions[0].breakdown).toHaveProperty('recency');
      expect(result.decisions[0].breakdown).toHaveProperty('priority');
    });

    it('should rank relevant items higher', () => {
      const result = retriever.retrieve({ query: 'testing' });

      // "Use Vitest for testing" should score higher than "Use React for frontend"
      if (result.decisions.length >= 2) {
        const vitestItem = result.decisions.find(d => d.item.title.includes('Vitest'));
        const reactItem = result.decisions.find(d => d.item.title.includes('React'));
        if (vitestItem && reactItem) {
          expect(vitestItem.score).toBeGreaterThan(reactItem.score);
        }
      }
    });

    it('should respect limit parameter', () => {
      const result = retriever.retrieve({ query: 'testing', limit: 1 });
      expect(result.decisions.length).toBeLessThanOrEqual(1);
      expect(result.constraints.length).toBeLessThanOrEqual(1);
      expect(result.goals.length).toBeLessThanOrEqual(1);
      expect(result.evidence.length).toBeLessThanOrEqual(1);
    });

    it('should search across all entity types', () => {
      // Add items with overlapping terms
      store.addDecision({ title: 'Database migration strategy' });
      store.addConstraint({ title: 'Database must be PostgreSQL', type: 'technical' });
      store.addGoal({ title: 'Complete database schema' });
      store.addEvidence({ type: 'test', title: 'Database tests passed', status: 'pass' });

      const result = retriever.retrieve({ query: 'database' });

      expect(result.decisions.length).toBeGreaterThanOrEqual(1);
      expect(result.constraints.length).toBeGreaterThanOrEqual(1);
      expect(result.goals.length).toBeGreaterThanOrEqual(1);
      expect(result.evidence.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty query gracefully', () => {
      // Empty query should still return results (based on recency/priority)
      const result = retriever.retrieve({ query: 'nonexistent_term_xyz' });
      expect(result).toBeDefined();
      expect(result.queryTime).toBeGreaterThanOrEqual(0);
    });

    it('should boost high priority items with priorityWeight', () => {
      const highPriority = retriever.retrieve({
        query: 'frontend',
        priorityWeight: 0.9,
        bm25Weight: 0.05,
        recencyWeight: 0.05,
      });

      // High priority decision (Vitest, priority=2) should score higher than lower priority
      if (highPriority.decisions.length >= 2) {
        expect(highPriority.decisions[0].item.priority).toBeGreaterThanOrEqual(
          highPriority.decisions[1].item.priority
        );
      }
    });
  });

  describe('retrieveActiveContext', () => {
    it('should return active goals', () => {
      const ctx = retriever.retrieveActiveContext();
      expect(ctx.goals.length).toBeGreaterThanOrEqual(2);
      expect(ctx.goals.every(g => g.status === 'active')).toBe(true);
    });

    it('should return only high/critical constraints', () => {
      const ctx = retriever.retrieveActiveContext();
      expect(ctx.constraints.length).toBeGreaterThanOrEqual(1);
      expect(ctx.constraints.every(c => c.severity === 'high' || c.severity === 'critical')).toBe(true);
    });

    it('should return active decisions', () => {
      const ctx = retriever.retrieveActiveContext();
      expect(ctx.decisions.length).toBeGreaterThanOrEqual(1);
      expect(ctx.decisions.every(d => d.status === 'active')).toBe(true);
    });

    it('should exclude completed goals', () => {
      store.addGoal({ title: 'Done goal', status: 'completed' });
      const ctx = retriever.retrieveActiveContext();
      expect(ctx.goals.every(g => g.status === 'active')).toBe(true);
    });
  });

  describe('scoring', () => {
    it('should have recency score close to 1 for recent items', () => {
      const result = retriever.retrieve({ query: 'Vitest' });
      if (result.decisions.length > 0) {
        // Just created, so recency should be very close to 1
        expect(result.decisions[0].breakdown.recency).toBeGreaterThan(0.99);
      }
    });

    it('should have priority score proportional to priority value', () => {
      const result = retriever.retrieve({ query: 'testing' });
      const vitestItem = result.decisions.find(d => d.item.title.includes('Vitest'));
      if (vitestItem) {
        // priority 2 → normalized to 1.0
        expect(vitestItem.breakdown.priority).toBe(1);
      }
    });

    it('evidence should score fail status higher than pass', () => {
      const result = retriever.retrieve({
        query: 'build',
        priorityWeight: 0.9,
        bm25Weight: 0.05,
        recencyWeight: 0.05,
      });
      if (result.evidence.length >= 2) {
        const failItem = result.evidence.find(e => e.item.status === 'fail');
        const passItem = result.evidence.find(e => e.item.status === 'pass');
        if (failItem && passItem) {
          expect(failItem.breakdown.priority).toBeGreaterThan(passItem.breakdown.priority);
        }
      }
    });
  });
});
