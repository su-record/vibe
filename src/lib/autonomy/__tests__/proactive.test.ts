import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';
import { MemoryStorage } from '../../memory/MemoryStorage.js';
import { EventBus } from '../EventBus.js';
import { SuggestionStore } from '../SuggestionStore.js';
import {
  ProactiveAnalyzer,
  SecurityScanner,
  PerformanceDetector,
  QualityChecker,
  DependencyMonitor,
} from '../ProactiveAnalyzer.js';
import { BackgroundMonitor } from '../BackgroundMonitor.js';

let storage: MemoryStorage;
let bus: EventBus;
let testDir: string;

const asStorage = (s: MemoryStorage): { getDatabase: () => ReturnType<typeof s.getDatabase> } =>
  s as unknown as { getDatabase: () => ReturnType<typeof s.getDatabase> };

beforeEach(() => {
  testDir = join(tmpdir(), `proactive-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  storage = new MemoryStorage(testDir);
  bus = new EventBus();
});

afterEach(() => {
  storage.close();
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

// ══════════════════════════════════════════════════
// Scenario 1: SuggestionStore CRUD + 중복 검사
// ══════════════════════════════════════════════════
describe('Scenario 1: SuggestionStore CRUD + dedup', () => {
  it('should create a suggestion', () => {
    const store = new SuggestionStore(asStorage(storage));
    const row = store.create({
      type: 'security',
      title: 'Hardcoded API key',
      description: 'Found hardcoded API key in config.ts',
      priority: 1,
      evidence: { filePath: 'config.ts' },
      sourceModule: 'SecurityScanner',
    });

    expect(row.id).toBeDefined();
    expect(row.status).toBe('pending');
    expect(row.type).toBe('security');
    expect(row.priority).toBe(1);
  });

  it('should deduplicate same title + type within 24h', () => {
    const store = new SuggestionStore(asStorage(storage));
    const first = store.create({
      type: 'security',
      title: 'Hardcoded API key',
      description: 'First detection',
      priority: 1,
      evidence: {},
      sourceModule: 'SecurityScanner',
    });

    const second = store.create({
      type: 'security',
      title: 'Hardcoded API key',
      description: 'Second detection',
      priority: 1,
      evidence: {},
      sourceModule: 'SecurityScanner',
    });

    expect(second.id).toBe(first.id);
  });

  it('should allow same title with different type', () => {
    const store = new SuggestionStore(asStorage(storage));
    const first = store.create({
      type: 'security',
      title: 'Issue found',
      description: 'Security issue',
      priority: 1,
      evidence: {},
      sourceModule: 'SecurityScanner',
    });

    const second = store.create({
      type: 'quality',
      title: 'Issue found',
      description: 'Quality issue',
      priority: 2,
      evidence: {},
      sourceModule: 'QualityChecker',
    });

    expect(second.id).not.toBe(first.id);
  });

  it('should resolve suggestion', () => {
    const store = new SuggestionStore(asStorage(storage));
    const row = store.create({
      type: 'security',
      title: 'Test suggestion',
      description: 'test',
      priority: 1,
      evidence: {},
      sourceModule: 'test',
    });

    const resolved = store.resolve(row.id, 'accepted');
    expect(resolved.status).toBe('accepted');
    expect(resolved.resolvedAt).toBeDefined();
  });

  it('should get pending ordered by priority', () => {
    const store = new SuggestionStore(asStorage(storage));
    store.create({ type: 'quality', title: 'Low priority', description: 't', priority: 5, evidence: {}, sourceModule: 't' });
    store.create({ type: 'security', title: 'High priority', description: 't', priority: 1, evidence: {}, sourceModule: 't' });
    store.create({ type: 'performance', title: 'Med priority', description: 't', priority: 3, evidence: {}, sourceModule: 't' });

    const pending = store.getPending();
    expect(pending.length).toBe(3);
    expect(pending[0].priority).toBe(1);
    expect(pending[1].priority).toBe(3);
    expect(pending[2].priority).toBe(5);
  });

  it('should return stats', () => {
    const store = new SuggestionStore(asStorage(storage));
    store.create({ type: 'security', title: 'A', description: 't', priority: 1, evidence: {}, sourceModule: 't' });
    store.create({ type: 'quality', title: 'B', description: 't', priority: 2, evidence: {}, sourceModule: 't' });
    store.create({ type: 'security', title: 'C', description: 't', priority: 1, evidence: {}, sourceModule: 't' });

    const stats = store.getStats();
    expect(stats.total).toBe(3);
    expect(stats.byType.security).toBe(2);
    expect(stats.byType.quality).toBe(1);
    expect(stats.pendingCount).toBe(3);
  });

  it('should get high priority suggestions', () => {
    const store = new SuggestionStore(asStorage(storage));
    store.create({ type: 'security', title: 'P1', description: 't', priority: 1, evidence: {}, sourceModule: 't' });
    store.create({ type: 'quality', title: 'P2', description: 't', priority: 2, evidence: {}, sourceModule: 't' });
    store.create({ type: 'dependency', title: 'P4', description: 't', priority: 4, evidence: {}, sourceModule: 't' });

    const high = store.getHighPriority(2);
    expect(high.length).toBe(2);
  });
});

// ══════════════════════════════════════════════════
// Scenario 2: SecurityScanner 분석
// ══════════════════════════════════════════════════
describe('Scenario 2: SecurityScanner', () => {
  it('should detect hardcoded secrets', async () => {
    const scanner = new SecurityScanner();
    const results = await scanner.analyze({
      trigger: 'file_changed',
      filePath: 'config.ts',
      fileContent: 'const API_KEY = "sk-abc123456789abcdef";',
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].type).toBe('security');
    expect(results[0].priority).toBe(1);
  });

  it('should detect dynamic SQL', async () => {
    const scanner = new SecurityScanner();
    const results = await scanner.analyze({
      trigger: 'file_changed',
      filePath: 'db.ts',
      fileContent: 'db.query(`SELECT * FROM users WHERE id = ${userId}`);',
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.title.includes('SQL'))).toBe(true);
  });

  it('should detect XSS patterns', async () => {
    const scanner = new SecurityScanner();
    const results = await scanner.analyze({
      trigger: 'file_changed',
      filePath: 'component.tsx',
      fileContent: '<div dangerouslySetInnerHTML={{ __html: userInput }} />',
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.title.includes('XSS'))).toBe(true);
  });

  it('should not flag safe code', async () => {
    const scanner = new SecurityScanner();
    const results = await scanner.analyze({
      trigger: 'file_changed',
      filePath: 'safe.ts',
      fileContent: 'const x = 42;\nfunction hello() { return "world"; }',
    });

    expect(results.length).toBe(0);
  });

  it('should only run on file_changed and manual triggers', () => {
    const scanner = new SecurityScanner();
    expect(scanner.shouldRun('file_changed')).toBe(true);
    expect(scanner.shouldRun('manual')).toBe(true);
    expect(scanner.shouldRun('session_start')).toBe(false);
    expect(scanner.shouldRun('scheduled')).toBe(false);
  });
});

// ══════════════════════════════════════════════════
// Other analysis modules
// ══════════════════════════════════════════════════
describe('PerformanceDetector', () => {
  it('should detect N+1 query patterns', async () => {
    const detector = new PerformanceDetector();
    const results = await detector.analyze({
      trigger: 'session_start',
      filePath: 'service.ts',
      fileContent: 'for (const item of items) {\n  db.query("SELECT * FROM details WHERE id = " + item.id);\n}',
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should only run on session_start and manual', () => {
    const detector = new PerformanceDetector();
    expect(detector.shouldRun('session_start')).toBe(true);
    expect(detector.shouldRun('manual')).toBe(true);
    expect(detector.shouldRun('file_changed')).toBe(false);
  });
});

describe('QualityChecker', () => {
  it('should detect many TODOs', async () => {
    const checker = new QualityChecker();
    const results = await checker.analyze({
      trigger: 'file_changed',
      filePath: 'messy.ts',
      fileContent: '// TODO fix\n// TODO refactor\n// TODO test\n// TODO cleanup\n// TODO docs\n',
    });

    expect(results.some((r) => r.title.includes('TODO'))).toBe(true);
  });

  it('should run on file_changed, build_complete, manual', () => {
    const checker = new QualityChecker();
    expect(checker.shouldRun('file_changed')).toBe(true);
    expect(checker.shouldRun('build_complete')).toBe(true);
    expect(checker.shouldRun('manual')).toBe(true);
    expect(checker.shouldRun('scheduled')).toBe(false);
  });
});

describe('DependencyMonitor', () => {
  it('should detect unpinned dependencies', async () => {
    const monitor = new DependencyMonitor();
    const results = await monitor.analyze({
      trigger: 'scheduled',
      filePath: 'package.json',
      fileContent: JSON.stringify({
        dependencies: { lodash: '*', express: '^4.0.0' },
      }),
    });

    expect(results.length).toBe(1);
    expect(results[0].title).toContain('lodash');
  });

  it('should only run on scheduled and manual', () => {
    const monitor = new DependencyMonitor();
    expect(monitor.shouldRun('scheduled')).toBe(true);
    expect(monitor.shouldRun('manual')).toBe(true);
    expect(monitor.shouldRun('file_changed')).toBe(false);
  });
});

// ══════════════════════════════════════════════════
// Scenario 3 + 4: BackgroundMonitor + Debouncing
// ══════════════════════════════════════════════════
describe('Scenario 3: BackgroundMonitor', () => {
  it('should start and stop', () => {
    const store = new SuggestionStore(asStorage(storage));
    const analyzer = new ProactiveAnalyzer({ store, eventBus: bus });
    const monitor = new BackgroundMonitor({ analyzer });

    monitor.start();
    expect(monitor.isStarted()).toBe(true);

    monitor.stop();
    expect(monitor.isStarted()).toBe(false);
  });

  it('should not start when disabled', () => {
    const store = new SuggestionStore(asStorage(storage));
    const analyzer = new ProactiveAnalyzer({ store, eventBus: bus });
    const monitor = new BackgroundMonitor({ analyzer, enabled: false });

    monitor.start();
    expect(monitor.isStarted()).toBe(false);
    expect(monitor.isEnabled()).toBe(false);
  });

  it('should report module status', () => {
    const store = new SuggestionStore(asStorage(storage));
    const analyzer = new ProactiveAnalyzer({ store, eventBus: bus });
    const monitor = new BackgroundMonitor({ analyzer });

    const status = monitor.getStatus();
    expect(status.length).toBe(4);
    expect(status.map((s) => s.name)).toContain('SecurityScanner');
    expect(status.map((s) => s.name)).toContain('PerformanceDetector');
  });

  it('should only process .ts/.js files', async () => {
    const store = new SuggestionStore(asStorage(storage));
    const analyzer = new ProactiveAnalyzer({ store, eventBus: bus });
    const monitor = new BackgroundMonitor({ analyzer });
    monitor.start();

    await monitor.onFileChanged('readme.md', 'const API_KEY = "sk-test12345678"');
    // Wait for potential debounce
    await new Promise((r) => { setTimeout(r, 600); });

    expect(store.getPending().length).toBe(0);
    monitor.stop();
  });
});

describe('Scenario 4: Debouncing', () => {
  it('should debounce rapid file changes (500ms)', async () => {
    const store = new SuggestionStore(asStorage(storage));
    const analyzeSpy = vi.fn().mockResolvedValue([]);
    const mockModule = {
      name: 'MockModule',
      shouldRun: () => true,
      analyze: analyzeSpy,
    };
    const analyzer = new ProactiveAnalyzer({
      store,
      eventBus: bus,
      modules: [mockModule],
    });

    // Rapid fire 5 analyses for same file
    for (let i = 0; i < 5; i++) {
      analyzer.analyze({
        trigger: 'file_changed',
        filePath: 'src/test.ts',
        fileContent: 'content',
      });
    }

    // Wait for debounce
    await new Promise((r) => { setTimeout(r, 700); });

    // Should only have run once
    expect(analyzeSpy).toHaveBeenCalledTimes(1);
    analyzer.clearDebounce();
  });

  it('should debounce independently per file', async () => {
    const store = new SuggestionStore(asStorage(storage));
    const analyzeSpy = vi.fn().mockResolvedValue([]);
    const mockModule = {
      name: 'MockModule',
      shouldRun: () => true,
      analyze: analyzeSpy,
    };
    const analyzer = new ProactiveAnalyzer({
      store,
      eventBus: bus,
      modules: [mockModule],
    });

    analyzer.analyze({ trigger: 'file_changed', filePath: 'file-a.ts', fileContent: 'a' });
    analyzer.analyze({ trigger: 'file_changed', filePath: 'file-b.ts', fileContent: 'b' });

    await new Promise((r) => { setTimeout(r, 700); });

    expect(analyzeSpy).toHaveBeenCalledTimes(2);
    analyzer.clearDebounce();
  });
});

// ══════════════════════════════════════════════════
// Scenario 8: 동시 분석 제한
// ══════════════════════════════════════════════════
describe('Scenario 8: Concurrency limit', () => {
  it('should limit concurrent analyses to 2', async () => {
    const store = new SuggestionStore(asStorage(storage));
    let concurrent = 0;
    let maxConcurrent = 0;

    const slowModule = {
      name: 'SlowModule',
      shouldRun: () => true,
      analyze: vi.fn().mockImplementation(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => { setTimeout(r, 100); });
        concurrent--;
        return [];
      }),
    };

    const analyzer = new ProactiveAnalyzer({
      store,
      eventBus: bus,
      modules: [slowModule],
    });
    const monitor = new BackgroundMonitor({ analyzer });
    monitor.start();

    // Trigger 4 analyses
    const promises = Array.from({ length: 4 }, (_, i) =>
      monitor.runAll(`content-${i}`, `file-${i}.ts`),
    );

    await Promise.all(promises);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
    monitor.stop();
  });
});

// ══════════════════════════════════════════════════
// ProactiveAnalyzer integration
// ══════════════════════════════════════════════════
describe('ProactiveAnalyzer integration', () => {
  it('should store suggestions from analysis', async () => {
    const store = new SuggestionStore(asStorage(storage));
    bus.on('suggestion_created', () => {});
    const analyzer = new ProactiveAnalyzer({ store, eventBus: bus });

    await analyzer.analyze({
      trigger: 'manual',
      filePath: 'config.ts',
      fileContent: 'const API_KEY = "sk-test12345678901234";',
    });

    const pending = store.getPending();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(pending[0].type).toBe('security');
  });

  it('should emit suggestion_created event', async () => {
    const store = new SuggestionStore(asStorage(storage));
    const events: unknown[] = [];
    bus.on('suggestion_created', (e) => { events.push(e); });

    const analyzer = new ProactiveAnalyzer({ store, eventBus: bus });
    await analyzer.analyze({
      trigger: 'manual',
      filePath: 'config.ts',
      fileContent: 'const secret = "sk-test12345678901234";',
    });

    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});

// ══════════════════════════════════════════════════
// Phase 4 module exports
// ══════════════════════════════════════════════════
describe('Phase 4 module exports', () => {
  it('should export all Phase 4 classes', async () => {
    const mod = await import('../index.js');
    expect(mod.SuggestionStore).toBeDefined();
    expect(mod.ProactiveAnalyzer).toBeDefined();
    expect(mod.BackgroundMonitor).toBeDefined();
    expect(mod.SecurityScanner).toBeDefined();
    expect(mod.PerformanceDetector).toBeDefined();
    expect(mod.QualityChecker).toBeDefined();
    expect(mod.DependencyMonitor).toBeDefined();
  });
});
