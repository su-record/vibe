import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStorage } from './MemoryStorage.js';
import { SessionRAGStore } from './SessionRAGStore.js';
import { rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SessionRAGStore', () => {
  let storage: MemoryStorage;
  let store: SessionRAGStore;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `vibe-srag-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    store = new SessionRAGStore(storage);
  });

  afterEach(() => {
    storage.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // Decisions
  // ==========================================================================

  describe('Decisions', () => {
    it('should add and retrieve a decision', () => {
      const id = store.addDecision({
        title: 'Use Vitest',
        rationale: 'Fast and modern test runner',
        priority: 2,
        tags: ['testing', 'tools'],
      });

      const decision = store.getDecision(id);
      expect(decision).not.toBeNull();
      expect(decision!.title).toBe('Use Vitest');
      expect(decision!.rationale).toBe('Fast and modern test runner');
      expect(decision!.priority).toBe(2);
      expect(decision!.tags).toEqual(['testing', 'tools']);
      expect(decision!.status).toBe('active');
      expect(decision!.alternatives).toEqual([]);
      expect(decision!.timestamp).toBeTruthy();
    });

    it('should add decision with all fields', () => {
      const id = store.addDecision({
        sessionId: 'session-1',
        title: 'Use React',
        description: 'Frontend framework choice',
        rationale: 'Component-based architecture',
        alternatives: ['Vue', 'Svelte'],
        impact: 'architecture',
        status: 'active',
        priority: 2,
        relatedFiles: ['src/App.tsx'],
        tags: ['frontend'],
      });

      const decision = store.getDecision(id);
      expect(decision!.sessionId).toBe('session-1');
      expect(decision!.alternatives).toEqual(['Vue', 'Svelte']);
      expect(decision!.relatedFiles).toEqual(['src/App.tsx']);
    });

    it('should update decision status', () => {
      const id = store.addDecision({ title: 'Use Jest', priority: 1 });

      const updated = store.updateDecision(id, { status: 'superseded' });
      expect(updated).toBe(true);

      const decision = store.getDecision(id);
      expect(decision!.status).toBe('superseded');
    });

    it('should list decisions by status', () => {
      store.addDecision({ title: 'Active 1' });
      store.addDecision({ title: 'Cancelled', status: 'cancelled' });
      store.addDecision({ title: 'Active 2' });

      const active = store.listDecisions(undefined, 'active');
      expect(active).toHaveLength(2);
      expect(active.every(d => d.status === 'active')).toBe(true);
    });

    it('should list decisions by session', () => {
      store.addDecision({ title: 'S1 Decision', sessionId: 's1' });
      store.addDecision({ title: 'S2 Decision', sessionId: 's2' });

      const s1 = store.listDecisions('s1');
      expect(s1).toHaveLength(1);
      expect(s1[0].title).toBe('S1 Decision');
    });

    it('should search decisions via FTS or LIKE', () => {
      store.addDecision({ title: 'Use React for frontend', rationale: 'Component-based' });
      store.addDecision({ title: 'Use Vitest for testing', rationale: 'Fast runner' });

      const results = store.searchDecisions('testing');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].title).toContain('Vitest');
    });

    it('should delete a decision', () => {
      const id = store.addDecision({ title: 'To delete' });
      expect(store.deleteDecision(id)).toBe(true);
      expect(store.getDecision(id)).toBeNull();
    });

    it('should return false for update with no fields', () => {
      const id = store.addDecision({ title: 'No update' });
      expect(store.updateDecision(id, {})).toBe(false);
    });
  });

  // ==========================================================================
  // Constraints
  // ==========================================================================

  describe('Constraints', () => {
    it('should add and retrieve a constraint', () => {
      const id = store.addConstraint({
        title: 'No vector DB dependencies',
        type: 'technical',
        severity: 'high',
      });

      const constraint = store.getConstraint(id);
      expect(constraint).not.toBeNull();
      expect(constraint!.title).toBe('No vector DB dependencies');
      expect(constraint!.type).toBe('technical');
      expect(constraint!.severity).toBe('high');
    });

    it('should default severity to medium', () => {
      const id = store.addConstraint({ title: 'Some constraint', type: 'business' });
      const constraint = store.getConstraint(id);
      expect(constraint!.severity).toBe('medium');
    });

    it('should update constraint', () => {
      const id = store.addConstraint({ title: 'Old title', type: 'technical' });
      store.updateConstraint(id, { title: 'New title', severity: 'critical' });

      const constraint = store.getConstraint(id);
      expect(constraint!.title).toBe('New title');
      expect(constraint!.severity).toBe('critical');
    });

    it('should list constraints by type', () => {
      store.addConstraint({ title: 'Tech 1', type: 'technical' });
      store.addConstraint({ title: 'Biz 1', type: 'business' });
      store.addConstraint({ title: 'Tech 2', type: 'technical' });

      const tech = store.listConstraints(undefined, 'technical');
      expect(tech).toHaveLength(2);
    });

    it('should list constraints by severity', () => {
      store.addConstraint({ title: 'Critical', type: 'technical', severity: 'critical' });
      store.addConstraint({ title: 'Low', type: 'technical', severity: 'low' });

      const critical = store.listConstraints(undefined, undefined, 'critical');
      expect(critical).toHaveLength(1);
      expect(critical[0].title).toBe('Critical');
    });

    it('should order constraints by severity (critical first)', () => {
      store.addConstraint({ title: 'Low', type: 'technical', severity: 'low' });
      store.addConstraint({ title: 'Critical', type: 'technical', severity: 'critical' });
      store.addConstraint({ title: 'High', type: 'technical', severity: 'high' });

      const all = store.listConstraints();
      expect(all[0].severity).toBe('critical');
      expect(all[1].severity).toBe('high');
      expect(all[2].severity).toBe('low');
    });

    it('should search constraints', () => {
      store.addConstraint({ title: 'No external APIs', type: 'technical' });
      store.addConstraint({ title: 'Budget limit $1000', type: 'business' });

      const results = store.searchConstraints('budget');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].title).toContain('Budget');
    });

    it('should delete a constraint', () => {
      const id = store.addConstraint({ title: 'To delete', type: 'technical' });
      expect(store.deleteConstraint(id)).toBe(true);
      expect(store.getConstraint(id)).toBeNull();
    });
  });

  // ==========================================================================
  // Goals
  // ==========================================================================

  describe('Goals', () => {
    it('should add and retrieve a goal', () => {
      const id = store.addGoal({
        title: 'Implement Session RAG',
        priority: 2,
        progressPercent: 50,
      });

      const goal = store.getGoal(id);
      expect(goal).not.toBeNull();
      expect(goal!.title).toBe('Implement Session RAG');
      expect(goal!.priority).toBe(2);
      expect(goal!.progressPercent).toBe(50);
      expect(goal!.status).toBe('active');
      expect(goal!.completedAt).toBeNull();
    });

    it('should get active goals only', () => {
      store.addGoal({ title: 'Active 1' });
      store.addGoal({ title: 'Completed', status: 'completed' });
      store.addGoal({ title: 'Active 2' });

      const active = store.getActiveGoals();
      expect(active).toHaveLength(2);
      expect(active.every(g => g.status === 'active')).toBe(true);
    });

    it('should set completedAt when status changes to completed', () => {
      const id = store.addGoal({ title: 'Goal to complete' });
      store.updateGoal(id, { status: 'completed' });

      const goal = store.getGoal(id);
      expect(goal!.status).toBe('completed');
      expect(goal!.completedAt).toBeTruthy();
    });

    it('should support goal hierarchy', () => {
      const parentId = store.addGoal({ title: 'Parent Goal' });
      store.addGoal({ title: 'Child 1', parentId });
      store.addGoal({ title: 'Child 2', parentId });

      const hierarchy = store.getGoalHierarchy(parentId);
      expect(hierarchy).toHaveLength(3);
    });

    it('should update progress percent', () => {
      const id = store.addGoal({ title: 'Progress goal' });
      store.updateGoal(id, { progressPercent: 75 });

      const goal = store.getGoal(id);
      expect(goal!.progressPercent).toBe(75);
    });

    it('should search goals', () => {
      store.addGoal({ title: 'Implement login feature' });
      store.addGoal({ title: 'Implement Session RAG' });

      const results = store.searchGoals('login');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].title).toContain('login');
    });

    it('should list goals by status', () => {
      store.addGoal({ title: 'Blocked', status: 'blocked' });
      store.addGoal({ title: 'Active' });
      store.addGoal({ title: 'Cancelled', status: 'cancelled' });

      const blocked = store.listGoals(undefined, 'blocked');
      expect(blocked).toHaveLength(1);
      expect(blocked[0].title).toBe('Blocked');
    });

    it('should delete a goal', () => {
      const id = store.addGoal({ title: 'To delete' });
      expect(store.deleteGoal(id)).toBe(true);
      expect(store.getGoal(id)).toBeNull();
    });
  });

  // ==========================================================================
  // Evidence
  // ==========================================================================

  describe('Evidence', () => {
    it('should add and retrieve evidence', () => {
      const id = store.addEvidence({
        type: 'test',
        title: 'Unit tests passed',
        status: 'pass',
        metrics: { coverage: 85, tests: 42 },
      });

      const evidence = store.getEvidence(id);
      expect(evidence).not.toBeNull();
      expect(evidence!.title).toBe('Unit tests passed');
      expect(evidence!.type).toBe('test');
      expect(evidence!.status).toBe('pass');
      expect(evidence!.metrics).toEqual({ coverage: 85, tests: 42 });
    });

    it('should add evidence with related goals', () => {
      const goalId = store.addGoal({ title: 'Test coverage goal' });
      const id = store.addEvidence({
        type: 'coverage',
        title: 'Coverage report',
        status: 'pass',
        relatedGoals: [goalId],
      });

      const evidence = store.getEvidence(id);
      expect(evidence!.relatedGoals).toEqual([goalId]);
    });

    it('should list evidence by type', () => {
      store.addEvidence({ type: 'test', title: 'Test 1', status: 'pass' });
      store.addEvidence({ type: 'build', title: 'Build 1', status: 'pass' });
      store.addEvidence({ type: 'test', title: 'Test 2', status: 'fail' });

      const tests = store.listEvidence(undefined, 'test');
      expect(tests).toHaveLength(2);
    });

    it('should list evidence by status', () => {
      store.addEvidence({ type: 'test', title: 'Pass', status: 'pass' });
      store.addEvidence({ type: 'test', title: 'Fail', status: 'fail' });

      const failed = store.listEvidence(undefined, undefined, 'fail');
      expect(failed).toHaveLength(1);
      expect(failed[0].title).toBe('Fail');
    });

    it('should get recent evidence', () => {
      store.addEvidence({ type: 'test', title: 'Old', status: 'pass' });
      store.addEvidence({ type: 'build', title: 'Recent', status: 'pass' });

      const recent = store.getRecentEvidence(1);
      expect(recent).toHaveLength(1);
      expect(recent[0].title).toBe('Recent');
    });

    it('should search evidence', () => {
      store.addEvidence({ type: 'test', title: 'Unit tests passed', status: 'pass' });
      store.addEvidence({ type: 'build', title: 'Build successful', status: 'pass' });

      const results = store.searchEvidence('unit');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].title).toContain('Unit');
    });

    it('should delete evidence', () => {
      const id = store.addEvidence({ type: 'test', title: 'To delete', status: 'info' });
      expect(store.deleteEvidence(id)).toBe(true);
      expect(store.getEvidence(id)).toBeNull();
    });
  });

  // ==========================================================================
  // Stats
  // ==========================================================================

  describe('Stats', () => {
    it('should return correct statistics', () => {
      store.addDecision({ title: 'D1' });
      store.addDecision({ title: 'D2', status: 'superseded' });
      store.addConstraint({ title: 'C1', type: 'technical' });
      store.addConstraint({ title: 'C2', type: 'business' });
      store.addGoal({ title: 'G1' });
      store.addGoal({ title: 'G2', status: 'completed' });
      store.addEvidence({ type: 'test', title: 'E1', status: 'pass' });

      const stats = store.getStats();
      expect(stats.decisions.total).toBe(2);
      expect(stats.decisions.byStatus.active).toBe(1);
      expect(stats.decisions.byStatus.superseded).toBe(1);
      expect(stats.constraints.total).toBe(2);
      expect(stats.constraints.byType.technical).toBe(1);
      expect(stats.constraints.byType.business).toBe(1);
      expect(stats.goals.total).toBe(2);
      expect(stats.goals.byStatus.active).toBe(1);
      expect(stats.goals.byStatus.completed).toBe(1);
      expect(stats.evidence.total).toBe(1);
      expect(stats.evidence.byType.test).toBe(1);
    });

    it('should return empty stats when no data', () => {
      const stats = store.getStats();
      expect(stats.decisions.total).toBe(0);
      expect(stats.constraints.total).toBe(0);
      expect(stats.goals.total).toBe(0);
      expect(stats.evidence.total).toBe(0);
    });
  });
});
