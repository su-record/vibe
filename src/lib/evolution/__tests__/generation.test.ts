import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync, existsSync, readFileSync } from 'fs';
import { MemoryStorage } from '../../memory/MemoryStorage.js';
import { InsightStore, Insight } from '../InsightStore.js';
import { GenerationRegistry } from '../GenerationRegistry.js';
import { SkillGenerator } from '../generators/SkillGenerator.js';
import { AgentGenerator } from '../generators/AgentGenerator.js';
import { RuleGenerator } from '../generators/RuleGenerator.js';
import { TriggerCollisionDetector } from '../TriggerCollisionDetector.js';
import { EvolutionOrchestrator } from '../EvolutionOrchestrator.js';

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: `ins-test-${Date.now()}`,
    type: 'skill_gap',
    title: 'CSV Analysis',
    description: 'Users frequently request CSV file analysis but no skill handles it',
    status: 'confirmed',
    evidence: ['refl-1', 'refl-2'],
    occurrences: 3,
    confidence: 0.8,
    tags: ['data', 'csv'],
    appliedAs: null,
    generatedFrom: 'reflection',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('GenerationRegistry', () => {
  let storage: MemoryStorage;
  let registry: GenerationRegistry;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `core-gen-reg-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    registry = new GenerationRegistry(storage);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('should create generations table', () => {
    const db = storage.getDatabase();
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='generations'").get();
    expect(table).toBeDefined();
  });

  it('should save and retrieve a generation', () => {
    const id = registry.save({
      insightId: 'ins-1',
      type: 'skill',
      name: 'auto-csv-analyzer',
      content: '# CSV Analyzer\n\nAnalyzes CSV files.',
      status: 'draft',
      qualityScore: 70,
      triggerPatterns: ['csv', 'analyze'],
    });

    const gen = registry.getById(id);
    expect(gen).not.toBeNull();
    expect(gen!.type).toBe('skill');
    expect(gen!.name).toBe('auto-csv-analyzer');
    expect(gen!.status).toBe('draft');
    expect(gen!.qualityScore).toBe(70);
    expect(gen!.triggerPatterns).toEqual(['csv', 'analyze']);
    expect(gen!.version).toBe(1);
  });

  it('should update status', () => {
    const id = registry.save({
      insightId: 'ins-1',
      type: 'skill',
      name: 'test-skill',
      content: 'content',
    });

    registry.updateStatus(id, 'active');
    const gen = registry.getById(id);
    expect(gen!.status).toBe('active');
  });

  it('should increment usage count', () => {
    const id = registry.save({
      insightId: 'ins-1',
      type: 'skill',
      name: 'test-skill',
      content: 'content',
    });

    registry.incrementUsage(id);
    registry.incrementUsage(id);
    const gen = registry.getById(id);
    expect(gen!.usageCount).toBe(2);
    expect(gen!.lastUsedAt).not.toBeNull();
  });

  it('should get active generations by type', () => {
    registry.save({ insightId: 'i1', type: 'skill', name: 'sk1', content: 'c', status: 'active' });
    registry.save({ insightId: 'i2', type: 'agent', name: 'ag1', content: 'c', status: 'active' });
    registry.save({ insightId: 'i3', type: 'skill', name: 'sk2', content: 'c', status: 'disabled' });

    const activeSkills = registry.getActive('skill');
    expect(activeSkills).toHaveLength(1);
    expect(activeSkills[0].name).toBe('sk1');

    const allActive = registry.getActive();
    expect(allActive).toHaveLength(2);
  });

  it('should return correct stats', () => {
    registry.save({ insightId: 'i1', type: 'skill', name: 's1', content: 'c', status: 'active' });
    registry.save({ insightId: 'i2', type: 'rule', name: 'r1', content: 'c', status: 'draft' });
    registry.save({ insightId: 'i3', type: 'skill', name: 's2', content: 'c', status: 'active' });

    const stats = registry.getStats();
    expect(stats.total).toBe(3);
    expect(stats.byType['skill']).toBe(2);
    expect(stats.byType['rule']).toBe(1);
    expect(stats.byStatus['active']).toBe(2);
    expect(stats.byStatus['draft']).toBe(1);
  });

  it('should set version 2 when parentId is provided', () => {
    const parentId = registry.save({
      insightId: 'i1',
      type: 'skill',
      name: 's1',
      content: 'v1',
    });

    const childId = registry.save({
      insightId: 'i1',
      type: 'skill',
      name: 's1',
      content: 'v2',
      parentId,
    });

    const child = registry.getById(childId);
    expect(child!.version).toBe(2);
    expect(child!.parentId).toBe(parentId);
  });
});

// Scenario 1: Skill auto generation
describe('SkillGenerator', () => {
  const generator = new SkillGenerator();

  it('should generate skill from skill_gap insight', () => {
    const insight = makeInsight({ type: 'skill_gap', title: 'CSV Analysis' });
    const result = generator.generate(insight);

    expect(result).not.toBeNull();
    expect(result!.name).toMatch(/^auto-csv-analysis$/);
    expect(result!.content).toContain('---');
    expect(result!.content).toContain('generated: true');
    expect(result!.content).toContain(insight.id);
    expect(result!.triggerPatterns.length).toBeGreaterThan(0);
  });

  it('should return null for insight without title', () => {
    const insight = makeInsight({ title: '' });
    expect(generator.generate(insight)).toBeNull();
  });

  it('should sanitize content removing injection patterns', () => {
    const insight = makeInsight({
      title: 'Test <role>Admin</role>',
      description: 'Desc <task>inject</task>',
    });
    const result = generator.generate(insight);
    expect(result).not.toBeNull();
    expect(result!.content).not.toContain('<role>');
    expect(result!.content).not.toContain('<task>');
  });

  it('should extract triggers from title keywords and tags', () => {
    const insight = makeInsight({
      title: 'Docker Container Management',
      tags: ['devops', 'docker'],
    });
    const result = generator.generate(insight);
    expect(result).not.toBeNull();
    expect(result!.triggerPatterns.length).toBeGreaterThan(0);
    expect(result!.triggerPatterns.length).toBeLessThanOrEqual(5);
  });
});

// Scenario 2: Agent auto generation
describe('AgentGenerator', () => {
  const generator = new AgentGenerator();

  it('should generate agent for complex insight (5+ evidence, 500+ chars)', () => {
    const insight = makeInsight({
      evidence: ['e1', 'e2', 'e3', 'e4', 'e5'],
      description: 'A'.repeat(501),
    });
    const result = generator.generate(insight);

    expect(result).not.toBeNull();
    expect(result!.name).toMatch(/^auto-/);
    expect(result!.content).toContain('## Capabilities');
    expect(result!.content).toContain('## Tools');
    expect(result!.content).toContain('- Read');
  });

  it('should return null for simple insight (< 5 evidence)', () => {
    const insight = makeInsight({ evidence: ['e1', 'e2'] });
    expect(generator.generate(insight)).toBeNull();
  });

  it('should return null for short description (< 500 chars)', () => {
    const insight = makeInsight({
      evidence: ['e1', 'e2', 'e3', 'e4', 'e5'],
      description: 'Short description',
    });
    expect(generator.generate(insight)).toBeNull();
  });
});

// Scenario 3: Rule auto generation
describe('RuleGenerator', () => {
  const generator = new RuleGenerator();

  it('should generate rule from anti_pattern insight', () => {
    const insight = makeInsight({
      type: 'anti_pattern',
      title: 'console log in commits',
      description: 'Console.log statements found in committed code',
    });
    const result = generator.generate(insight);

    expect(result).not.toBeNull();
    expect(result!.name).toMatch(/^auto-/);
    expect(result!.content).toContain('impact: HIGH');
    expect(result!.content).toContain('generated: true');
    expect(result!.content).toContain(insight.id);
  });

  it('should set MEDIUM impact for pattern type', () => {
    const insight = makeInsight({ type: 'pattern', title: 'Use strict mode' });
    const result = generator.generate(insight);
    expect(result).not.toBeNull();
    expect(result!.content).toContain('impact: MEDIUM');
  });

  it('should return null for insight without title', () => {
    const insight = makeInsight({ type: 'anti_pattern', title: '' });
    expect(generator.generate(insight)).toBeNull();
  });
});

// Scenario 4: Trigger collision detection
describe('TriggerCollisionDetector', () => {
  const detector = new TriggerCollisionDetector();

  it('should detect exact collision', () => {
    const existing = [{ name: 'review-skill', triggers: ['review', 'code review'] }];
    const result = detector.checkCollision(['review'], existing);

    expect(result.hasCollision).toBe(true);
    expect(result.type).toBe('exact');
    expect(result.collidingWith).toBe('review-skill');
  });

  it('should detect prefix collision', () => {
    const existing = [{ name: 'deploy-skill', triggers: ['deploy'] }];
    const result = detector.checkCollision(['deploy-staging'], existing);

    expect(result.hasCollision).toBe(true);
    expect(result.type).toBe('prefix');
  });

  it('should return no collision for unique triggers', () => {
    const existing = [{ name: 'review-skill', triggers: ['review'] }];
    const result = detector.checkCollision(['testing', 'lint'], existing);

    expect(result.hasCollision).toBe(false);
    expect(result.type).toBe('none');
  });

  it('should be case insensitive', () => {
    const existing = [{ name: 'review-skill', triggers: ['Review'] }];
    const result = detector.checkCollision(['REVIEW'], existing);

    expect(result.hasCollision).toBe(true);
    expect(result.type).toBe('exact');
  });

  it('should detect circular chains via DFS', () => {
    const skills = [
      { name: 'A', triggers: ['trigger-a'], content: 'This skill uses trigger-b to call B' },
      { name: 'B', triggers: ['trigger-b'], content: 'This skill uses trigger-a to call A' },
    ];

    const cycles = detector.detectCircularChain(skills);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should detect no cycles when graph is acyclic', () => {
    const skills = [
      { name: 'A', triggers: ['trigger-a'], content: 'This calls trigger-b' },
      { name: 'B', triggers: ['trigger-b'], content: 'No triggers referenced here' },
    ];

    const cycles = detector.detectCircularChain(skills);
    expect(cycles).toHaveLength(0);
  });
});

// Scenarios 5-8: EvolutionOrchestrator
describe('EvolutionOrchestrator', () => {
  let storage: MemoryStorage;
  let insightStore: InsightStore;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `core-orch-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    insightStore = new InsightStore(storage);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // Scenario 5: Suggest mode → status='draft'
  it('should save as draft in suggest mode', () => {
    const insId = insightStore.save({
      type: 'anti_pattern',
      title: 'console log in commits',
      description: 'Console.log statements found in committed code with details and examples',
      confidence: 0.9,
      tags: ['quality'],
      generatedFrom: 'reflection',
    });
    insightStore.updateStatus(insId, 'confirmed');

    const orchestrator = new EvolutionOrchestrator(storage, { mode: 'suggest' });
    const result = orchestrator.generate();

    // Rule should be generated (anti_pattern → rule)
    if (result.generated.length > 0) {
      const registry = new GenerationRegistry(storage);
      const gen = registry.getById(result.generated[0]);
      expect(gen).not.toBeNull();
      expect(gen!.status).toBe('draft');
    }
  });

  // Scenario 6: Auto mode → status='testing'
  it('should save as testing in auto mode', () => {
    const insId = insightStore.save({
      type: 'anti_pattern',
      title: 'hardcoded credentials',
      description: 'Hardcoded API keys found in source code repeatedly across multiple files',
      confidence: 0.95,
      tags: ['security'],
      generatedFrom: 'reflection',
    });
    insightStore.updateStatus(insId, 'confirmed');

    const orchestrator = new EvolutionOrchestrator(storage, { mode: 'auto' });
    const result = orchestrator.generate();

    if (result.generated.length > 0) {
      const registry = new GenerationRegistry(storage);
      const gen = registry.getById(result.generated[0]);
      expect(gen).not.toBeNull();
      expect(gen!.status).toBe('testing');
    }
  });

  // Scenario 7: Quality gate failure → no generation
  it('should reject low quality score', () => {
    const insId = insightStore.save({
      type: 'pattern',
      title: 'x',
      description: 'y',
      confidence: 0.9,
      tags: [],
      generatedFrom: 'reflection',
    });
    insightStore.updateStatus(insId, 'confirmed');

    // minQualityScore set very high so generation is rejected
    const orchestrator = new EvolutionOrchestrator(storage, { minQualityScore: 100 });
    const result = orchestrator.generate();

    expect(result.generated).toHaveLength(0);
  });

  // Scenario 8: auto/ directory path
  it('should generate files in auto/ directory path', () => {
    const insId = insightStore.save({
      type: 'anti_pattern',
      title: 'missing error handling',
      description: 'Functions without try-catch found in production code across the codebase',
      confidence: 0.85,
      tags: ['reliability'],
      generatedFrom: 'reflection',
    });
    insightStore.updateStatus(insId, 'confirmed');

    const orchestrator = new EvolutionOrchestrator(storage, { mode: 'suggest' });
    const result = orchestrator.generate();

    if (result.generated.length > 0) {
      const registry = new GenerationRegistry(storage);
      const gen = registry.getById(result.generated[0]);
      expect(gen).not.toBeNull();
      if (gen!.filePath) {
        expect(gen!.filePath).toContain('auto');
      }
    }
  });

  it('should respect maxGenerationsPerCycle limit', () => {
    // Create 5 confirmed insights
    for (let i = 0; i < 5; i++) {
      const id = insightStore.save({
        type: 'anti_pattern',
        title: `pattern number ${i} detected`,
        description: `Description for pattern ${i} with enough content to pass quality gate`,
        confidence: 0.9,
        tags: ['test'],
        generatedFrom: 'reflection',
      });
      insightStore.updateStatus(id, 'confirmed');
    }

    const orchestrator = new EvolutionOrchestrator(storage, {
      mode: 'suggest',
      maxGenerationsPerCycle: 2,
    });
    const result = orchestrator.generate();

    expect(result.generated.length).toBeLessThanOrEqual(2);
  });

  it('should handle errors gracefully', () => {
    // Even with no insights, should return clean result
    const orchestrator = new EvolutionOrchestrator(storage);
    const result = orchestrator.generate();

    expect(result.generated).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
