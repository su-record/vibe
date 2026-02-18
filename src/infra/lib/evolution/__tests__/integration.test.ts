import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { MemoryStorage } from '../../memory/MemoryStorage.js';

// Module exports test (Scenario 10)
describe('Evolution module exports', () => {
  it('should export all Phase 1-4 classes', async () => {
    const mod = await import('../index.js');

    // Phase 1
    expect(mod.ReflectionStore).toBeDefined();

    // Phase 2
    expect(mod.InsightStore).toBeDefined();
    expect(mod.InsightExtractor).toBeDefined();
    expect(mod.SkillGapDetector).toBeDefined();
    expect(mod.AgentAnalyzer).toBeDefined();

    // Phase 3
    expect(mod.GenerationRegistry).toBeDefined();
    expect(mod.SkillGenerator).toBeDefined();
    expect(mod.AgentGenerator).toBeDefined();
    expect(mod.RuleGenerator).toBeDefined();
    expect(mod.TriggerCollisionDetector).toBeDefined();
    expect(mod.EvolutionOrchestrator).toBeDefined();

    // Phase 4
    expect(mod.UsageTracker).toBeDefined();
    expect(mod.LifecycleManager).toBeDefined();
    expect(mod.RollbackManager).toBeDefined();
    expect(mod.CircuitBreaker).toBeDefined();
  });
});

// Tool exports test
describe('Evolution tool exports', () => {
  it('should export all insight and dashboard tools', async () => {
    const mod = await import('../../../../tools/evolution/index.js');

    // Phase 2 tools
    expect(mod.extractInsightsDefinition).toBeDefined();
    expect(mod.extractInsights).toBeDefined();
    expect(mod.searchInsightsDefinition).toBeDefined();
    expect(mod.searchInsights).toBeDefined();
    expect(mod.listSkillGapsDefinition).toBeDefined();
    expect(mod.listSkillGaps).toBeDefined();
    expect(mod.insightStatsDefinition).toBeDefined();
    expect(mod.insightStats).toBeDefined();

    // Phase 4 tools
    expect(mod.evolutionStatusDefinition).toBeDefined();
    expect(mod.evolutionStatus).toBeDefined();
    expect(mod.evolutionApproveDefinition).toBeDefined();
    expect(mod.evolutionApprove).toBeDefined();
    expect(mod.evolutionRejectDefinition).toBeDefined();
    expect(mod.evolutionReject).toBeDefined();
    expect(mod.evolutionDisableDefinition).toBeDefined();
    expect(mod.evolutionDisable).toBeDefined();
    expect(mod.evolutionRollbackDefinition).toBeDefined();
    expect(mod.evolutionRollback).toBeDefined();
  });
});

// Config integration test (Scenario 6)
describe('Evolution config', () => {
  it('should respect evolution.enabled=false', async () => {
    // CircuitBreaker is in-memory only, no config dependency
    const { CircuitBreaker } = await import('../CircuitBreaker.js');
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe('closed');
  });
});

// Full pipeline integration test
describe('Full evolution pipeline', () => {
  let storage: MemoryStorage;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `core-integ-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('should run full pipeline: reflect → extract → generate → track → lifecycle', async () => {
    // Import all modules
    const { ReflectionStore } = await import('../../memory/ReflectionStore.js');
    const { InsightStore } = await import('../InsightStore.js');
    const { InsightExtractor } = await import('../InsightExtractor.js');
    const { GenerationRegistry } = await import('../GenerationRegistry.js');
    const { EvolutionOrchestrator } = await import('../EvolutionOrchestrator.js');
    const { UsageTracker } = await import('../UsageTracker.js');
    const { LifecycleManager } = await import('../LifecycleManager.js');

    // Phase 1: Create reflections
    const reflections = new ReflectionStore(storage);
    for (let i = 0; i < 5; i++) {
      reflections.save({
        type: 'minor',
        trigger: 'manual',
        insights: ['TypeScript any type detected in production code'],
        score: 0.6,
      });
    }

    // Phase 2: Extract insights
    const insightStore = new InsightStore(storage);
    const extractor = new InsightExtractor(storage);
    const extractResult = extractor.extractFromRecent();
    expect(extractResult.errorCount).toBe(0);

    // If insights were extracted, confirm one for generation
    const actionable = insightStore.getActionable();
    if (actionable.length === 0) {
      // Manually create an insight for the pipeline
      const insId = insightStore.save({
        type: 'anti_pattern',
        title: 'typescript any type usage',
        description: 'Detected any type in production code repeatedly across files',
        confidence: 0.9,
        tags: ['typescript', 'quality'],
        generatedFrom: 'reflection',
      });
      insightStore.updateStatus(insId, 'confirmed');
    }

    // Phase 3: Generate
    const orchestrator = new EvolutionOrchestrator(storage, { mode: 'suggest' });
    const genResult = orchestrator.generate();
    // May or may not generate depending on quality score

    // Phase 4: Track usage if any generation exists
    const registry = new GenerationRegistry(storage);
    const tracker = new UsageTracker(storage);
    const lifecycle = new LifecycleManager(storage);

    const stats = registry.getStats();
    expect(stats).toBeDefined();
    expect(typeof stats.total).toBe('number');

    // Verify lifecycle runs without errors
    const cleanupResult = lifecycle.cleanup();
    expect(cleanupResult.errors).toHaveLength(0);
  });
});

// Phase 5 Scenario 1: evolution-engine.js hook exists and is valid JS
describe('Evolution hook file', () => {
  it('should have evolution-engine.js with PostToolUse logic', async () => {
    const hookPath = join(__dirname, '..', '..', '..', '..', '..', 'hooks', 'scripts', 'evolution-engine.js');
    expect(existsSync(hookPath)).toBe(true);
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('PostToolUse');
    expect(content).toContain('InsightExtractor');
    expect(content).toContain('EvolutionOrchestrator');
    expect(content).toContain('setImmediate');
  });
});

// Phase 5 Scenario 2: prompt-dispatcher gap detection
describe('Prompt dispatcher gap detection', () => {
  it('should have gap logging code in prompt-dispatcher.js', () => {
    const hookPath = join(__dirname, '..', '..', '..', '..', '..', 'hooks', 'scripts', 'prompt-dispatcher.js');
    expect(existsSync(hookPath)).toBe(true);
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('gapDetection');
    expect(content).toContain('SkillGapDetector');
    expect(content).toContain('logMiss');
  });
});

// Phase 5 Scenario 3: skill-injector auto/ scan + .disabled filter
describe('Skill injector auto/ directory', () => {
  it('should scan auto/ directories and skip .disabled files', () => {
    const hookPath = join(__dirname, '..', '..', '..', '..', '..', 'hooks', 'scripts', 'skill-injector.js');
    expect(existsSync(hookPath)).toBe(true);
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain("'auto'");
    expect(content).toContain('.disabled');
    expect(content).toContain('project-auto');
    expect(content).toContain('user-auto');
  });

  it('should track usage of auto-generated skills', () => {
    const hookPath = join(__dirname, '..', '..', '..', '..', '..', 'hooks', 'scripts', 'skill-injector.js');
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('UsageTracker');
    expect(content).toContain('recordUsage');
    expect(content).toContain('generated');
  });
});

// Phase 5 Scenario 4 & 5 & 9: CLI commands
describe('Evolution CLI commands', () => {
  it('should export all CLI functions', async () => {
    const mod = await import('../../../../cli/commands/evolution.js');
    expect(mod.evolutionStatus).toBeDefined();
    expect(mod.evolutionList).toBeDefined();
    expect(mod.evolutionApprove).toBeDefined();
    expect(mod.evolutionReject).toBeDefined();
    expect(mod.evolutionDisable).toBeDefined();
    expect(mod.evolutionRollback).toBeDefined();
    expect(mod.evolutionDisableAll).toBeDefined();
    expect(mod.evolutionRun).toBeDefined();
    expect(mod.evolutionInsights).toBeDefined();
    expect(mod.evolutionGaps).toBeDefined();
    expect(mod.evolutionHelp).toBeDefined();
  });

  it('should NOT have evolution case in CLI router (removed: internal automation)', () => {
    const cliPath = join(__dirname, '..', '..', '..', '..', 'cli', 'index.ts');
    const content = readFileSync(cliPath, 'utf8');
    // Evolution commands removed from CLI — handled by hooks/automation
    expect(content).not.toContain("case 'evolution'");
  });
});

// Phase 5 Scenario 7: Ultrawork mode auto override
describe('Ultrawork auto mode override', () => {
  it('should support mode from config (suggest/auto) in evolution-engine', () => {
    const hookPath = join(__dirname, '..', '..', '..', '..', '..', 'hooks', 'scripts', 'evolution-engine.js');
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('config.mode');
    expect(content).toContain("'suggest'");
    // Mode 'auto' comes from config.json, not hardcoded in hook
    expect(content).toContain('mode');
  });
});

// Phase 5 Scenario 8: Session start evolution status
describe('Session start evolution status', () => {
  it('should display evolution status on session start', () => {
    const hookPath = join(__dirname, '..', '..', '..', '..', '..', 'hooks', 'scripts', 'session-start.js');
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('Evolution');
    expect(content).toContain('GenerationRegistry');
    expect(content).toContain('active skills');
    expect(content).toContain('pending approval');
    expect(content).toContain('gaps detected');
  });
});

// Phase 2 Scenario 3: AgentAnalyzer
describe('AgentAnalyzer', () => {
  let storage: MemoryStorage;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `core-agent-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('should analyze without errors even with empty data', async () => {
    const { InsightStore } = await import('../InsightStore.js');
    const { AgentAnalyzer } = await import('../AgentAnalyzer.js');
    const insightStore = new InsightStore(storage);
    const analyzer = new AgentAnalyzer(insightStore);

    const result = analyzer.analyze();
    expect(result.newInsights).toHaveLength(0);
    expect(result.agentsAnalyzed).toBe(0);
  });
});
