import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';
import { MemoryStorage } from '../../memory/MemoryStorage.js';
import { EventBus } from '../EventBus.js';
import { AuditStore } from '../AuditStore.js';
import { RiskClassifier } from '../RiskClassifier.js';
import type { RiskAssessment } from '../RiskClassifier.js';
import { PolicyEngine } from '../PolicyEngine.js';
import { SecuritySentinel } from '../SecuritySentinel.js';
import { isSentinelProtectedPath } from '../SecuritySentinel.js';
import type { AgentActionEvent } from '../schemas.js';

let storage: MemoryStorage;
let bus: EventBus;
let auditStore: AuditStore;
let testDir: string;

const asStorage = (s: MemoryStorage): { getDatabase: () => ReturnType<typeof s.getDatabase> } =>
  s as unknown as { getDatabase: () => ReturnType<typeof s.getDatabase> };

beforeEach(() => {
  testDir = join(tmpdir(), `sentinel-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  storage = new MemoryStorage(testDir);
  bus = new EventBus();
  auditStore = new AuditStore(asStorage(storage));
  SecuritySentinel.resetInstance();
});

afterEach(() => {
  storage.close();
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors on Windows
  }
});

function makeAction(overrides: Partial<AgentActionEvent> = {}): AgentActionEvent {
  return {
    agentId: 'test-agent',
    actionType: 'file_write',
    target: 'src/utils/helper.ts',
    params: {},
    ...overrides,
  };
}

// ══════════════════════════════════════════════════
// Scenario 1: LOW 위험 행위 분류
// ══════════════════════════════════════════════════
describe('Scenario 1: RiskClassifier LOW classification', () => {
  it('should classify normal file_write as LOW', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(makeAction());
    expect(result.riskLevel).toBe('LOW');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(33);
  });

  it('should classify external_api_call without auth as LOW', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeAction({ actionType: 'external_api_call', target: 'https://api.example.com' }),
    );
    expect(result.riskLevel).toBe('LOW');
  });

  it('should classify skill_generate without rule as LOW', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeAction({ actionType: 'skill_generate', target: 'my-new-skill' }),
    );
    expect(result.riskLevel).toBe('LOW');
  });
});

// ══════════════════════════════════════════════════
// Scenario 2: 조건부 HIGH 위험 상승
// ══════════════════════════════════════════════════
describe('Scenario 2: RiskClassifier conditional HIGH escalation', () => {
  it('should classify force push as HIGH with factor', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeAction({
        actionType: 'git_push',
        target: 'origin main --force',
        params: { force: true },
      }),
    );
    expect(result.riskLevel).toBe('HIGH');
    expect(result.factors).toEqual(
      expect.arrayContaining([expect.stringContaining('orce push')]),
    );
  });

  it('should classify security file write as HIGH', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeAction({ target: 'src/auth/login.ts' }),
    );
    expect(result.riskLevel).toBe('HIGH');
  });

  it('should classify dangerous bash command as HIGH', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeAction({ actionType: 'bash_exec', target: 'rm -rf /tmp/data' }),
    );
    expect(result.riskLevel).toBe('HIGH');
  });

  it('should classify external API call with auth credentials as HIGH', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeAction({
        actionType: 'external_api_call',
        target: 'https://api.example.com',
        params: { headers: { Authorization: 'Bearer token123' } },
      }),
    );
    expect(result.riskLevel).toBe('HIGH');
  });

  it('should classify config_modify with sentinel as HIGH', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeAction({ actionType: 'config_modify', target: 'sentinel.rules' }),
    );
    expect(result.riskLevel).toBe('HIGH');
  });

  it('should classify sentinel file write as HIGH with blocked', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeAction({ target: 'src/lib/autonomy/SecuritySentinel.ts' }),
    );
    expect(result.riskLevel).toBe('HIGH');
    expect(result.score).toBe(100);
    expect(result.blocked).toBe(true);
  });

  it('should classify skill_generate with rule as MEDIUM', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeAction({ actionType: 'skill_generate', target: 'new-rule-generator' }),
    );
    expect(result.riskLevel).toBe('MEDIUM');
  });
});

// ══════════════════════════════════════════════════
// MEDIUM 기본 분류
// ══════════════════════════════════════════════════
describe('RiskClassifier MEDIUM classification', () => {
  it('should classify file_delete as MEDIUM', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeAction({ actionType: 'file_delete', target: 'src/old-file.ts' }),
    );
    expect(result.riskLevel).toBe('MEDIUM');
  });

  it('should classify bash_exec (safe command) as MEDIUM', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeAction({ actionType: 'bash_exec', target: 'echo hello' }),
    );
    expect(result.riskLevel).toBe('MEDIUM');
  });

  it('should classify dependency_install as MEDIUM', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeAction({ actionType: 'dependency_install', target: 'lodash' }),
    );
    expect(result.riskLevel).toBe('MEDIUM');
  });

  it('should classify mass delete (5+) as HIGH', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeAction({ actionType: 'file_delete', target: 'src/old-file.ts' }),
      { recentDeleteCount: 5 },
    );
    expect(result.riskLevel).toBe('HIGH');
  });
});

// ══════════════════════════════════════════════════
// Custom rules
// ══════════════════════════════════════════════════
describe('RiskClassifier custom rules', () => {
  it('should apply custom rule override', () => {
    const classifier = new RiskClassifier([
      { actionType: 'file_write', targetPattern: '\\.test\\.ts$', riskLevel: 'HIGH' },
    ]);
    const result = classifier.classify(
      makeAction({ target: 'src/utils/helper.test.ts' }),
    );
    expect(result.riskLevel).toBe('HIGH');
    expect(result.factors[0]).toContain('Custom rule');
  });

  it('should fallback to default when custom rule does not match', () => {
    const classifier = new RiskClassifier([
      { actionType: 'file_write', targetPattern: '\\.test\\.ts$', riskLevel: 'HIGH' },
    ]);
    const result = classifier.classify(makeAction());
    expect(result.riskLevel).toBe('LOW');
  });

  it('should skip invalid custom rules', () => {
    const classifier = new RiskClassifier([
      { actionType: '', riskLevel: 'LOW' } as never,
    ]);
    const result = classifier.classify(makeAction());
    expect(result.riskLevel).toBe('LOW');
  });
});

// ══════════════════════════════════════════════════
// Input sanitization
// ══════════════════════════════════════════════════
describe('RiskClassifier input sanitization', () => {
  it('should strip control characters from input', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeAction({
        agentId: 'test\u0000agent',
        target: 'src/\u001Futils/helper.ts',
      }),
    );
    expect(result.riskLevel).toBe('LOW');
  });
});

// ══════════════════════════════════════════════════
// Scenario 3: PolicyEngine 기본 정책 평가
// ══════════════════════════════════════════════════
describe('Scenario 3: PolicyEngine evaluation', () => {
  it('should load 5 default policies', () => {
    const engine = new PolicyEngine(asStorage(storage));
    expect(engine.getPolicyCount()).toBe(5);
  });

  it('should block force push via deny-force-push policy', () => {
    const engine = new PolicyEngine(asStorage(storage));
    const action = makeAction({
      actionType: 'git_push',
      target: 'origin main',
      params: { force: true },
    });
    const risk: RiskAssessment = {
      riskLevel: 'HIGH',
      score: 80,
      factors: ['Force push detected'],
      reasoning: 'Git force push',
    };
    const decision = engine.evaluate(action, risk);
    expect(decision.allowed).toBe(false);
    expect(decision.matchedPolicies).toContain('deny-force-push');
  });

  it('should block sentinel file modification via deny-sentinel-modify', () => {
    const engine = new PolicyEngine(asStorage(storage));
    const action = makeAction({ target: 'src/lib/autonomy/EventBus.ts' });
    const risk: RiskAssessment = {
      riskLevel: 'HIGH',
      score: 100,
      factors: [],
      reasoning: 'Sentinel file',
    };
    const decision = engine.evaluate(action, risk);
    expect(decision.allowed).toBe(false);
    expect(decision.matchedPolicies).toContain('deny-sentinel-modify');
  });

  it('should require confirmation for high-risk actions', () => {
    const engine = new PolicyEngine(asStorage(storage));
    const action = makeAction({
      actionType: 'bash_exec',
      target: 'npm install some-pkg',
    });
    const risk: RiskAssessment = {
      riskLevel: 'HIGH',
      score: 80,
      factors: [],
      reasoning: 'High risk bash',
    };
    const decision = engine.evaluate(action, risk);
    expect(decision.allowed).toBe(false);
    expect(decision.requiredAction).toBe('confirm');
    expect(decision.matchedPolicies).toContain('require-approval-high-risk');
  });

  it('should allow low-risk actions', () => {
    const engine = new PolicyEngine(asStorage(storage));
    const action = makeAction();
    const risk: RiskAssessment = {
      riskLevel: 'LOW',
      score: 15,
      factors: [],
      reasoning: 'Standard file write',
    };
    const decision = engine.evaluate(action, risk);
    expect(decision.allowed).toBe(true);
    expect(decision.matchedPolicies).toContain('audit-all-actions');
  });

  it('should prioritize deny over require-approval', () => {
    const engine = new PolicyEngine(asStorage(storage));
    const action = makeAction({
      actionType: 'file_delete',
      target: 'src/old.ts',
    });
    const risk: RiskAssessment = {
      riskLevel: 'HIGH',
      score: 80,
      factors: ['Mass delete'],
      reasoning: 'Mass deletion',
    };
    const decision = engine.evaluate(action, risk);
    expect(decision.allowed).toBe(false);
    expect(decision.requiredAction).toBe('block');
  });
});

// ══════════════════════════════════════════════════
// Scenario 9: 커스텀 정책 오버라이드
// ══════════════════════════════════════════════════
describe('Scenario 9: Custom policy override', () => {
  it('should add and evaluate custom policies', () => {
    const engine = new PolicyEngine(asStorage(storage));
    engine.addPolicy({
      name: 'deny-test-files',
      description: 'Block writing to test files',
      rules: [
        { field: 'target', operator: 'matches', value: '\\.test\\.ts$' },
      ],
      action: 'block',
      priority: 200,
    });

    const action = makeAction({ target: 'src/utils/helper.test.ts' });
    const risk: RiskAssessment = {
      riskLevel: 'LOW',
      score: 15,
      factors: [],
      reasoning: 'Standard',
    };
    const decision = engine.evaluate(action, risk);
    expect(decision.allowed).toBe(false);
    expect(decision.matchedPolicies).toContain('deny-test-files');
  });

  it('should respect custom policy priority alongside defaults', () => {
    const engine = new PolicyEngine(asStorage(storage));
    expect(engine.getPolicyCount()).toBe(5);

    engine.addPolicy({
      name: 'custom-allow-test',
      rules: [],
      action: 'allow',
      priority: 0,
    });
    expect(engine.getPolicyCount()).toBe(6);
  });
});

// ══════════════════════════════════════════════════
// Scenario 4: SecuritySentinel intercept 성능
// ══════════════════════════════════════════════════
describe('Scenario 4: SecuritySentinel intercept performance', () => {
  it('should complete intercept within 10ms on average', () => {
    bus.on('policy_check', () => {});
    bus.on('error', () => {});

    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });

    const actions = Array.from({ length: 100 }, (_, i) =>
      makeAction({ agentId: `agent-${i}`, target: `src/utils/file-${i}.ts` }),
    );

    const start = performance.now();
    for (const action of actions) {
      sentinel.intercept(action);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / 100;

    expect(avgMs).toBeLessThan(10);
  });
});

// ══════════════════════════════════════════════════
// Scenario 5: Sentinel 파일 보호
// ══════════════════════════════════════════════════
describe('Scenario 5: Sentinel file protection', () => {
  it('should block modification of src/lib/autonomy/ files', () => {
    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });

    const result = sentinel.intercept(
      makeAction({ target: 'src/lib/autonomy/SecuritySentinel.ts' }),
    );

    expect(result.allowed).toBe(false);
    expect(result.policyDecision.reason).toContain('Sentinel files are protected');
  });

  it('should block path traversal attempts targeting sentinel', () => {
    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });

    const result = sentinel.intercept(
      makeAction({ target: '../other-project/../vibe/src/lib/autonomy/EventBus.ts' }),
    );

    // Path normalization should resolve this outside project or to sentinel path
    expect(result.allowed).toBe(false);
  });

  it('should allow modification of non-sentinel files', () => {
    bus.on('policy_check', () => {});
    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });

    const result = sentinel.intercept(
      makeAction({ target: 'src/utils/helper.ts' }),
    );

    expect(result.allowed).toBe(true);
  });

  it('isSentinelProtectedPath should detect sentinel paths', () => {
    expect(isSentinelProtectedPath('src/lib/autonomy/EventBus.ts')).toBe(true);
    expect(isSentinelProtectedPath('src/lib/autonomy/foo/bar.ts')).toBe(true);
    expect(isSentinelProtectedPath('src/utils/helper.ts')).toBe(false);
    expect(isSentinelProtectedPath('./src/lib/autonomy/test.ts')).toBe(true);
  });
});

// ══════════════════════════════════════════════════
// Scenario 7: 차단 사유 메시지
// ══════════════════════════════════════════════════
describe('Scenario 7: Block reason messages', () => {
  it('should include specific reason for sentinel file block', () => {
    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });

    const result = sentinel.intercept(
      makeAction({ target: 'src/lib/autonomy/index.ts' }),
    );

    expect(result.allowed).toBe(false);
    expect(result.policyDecision.reason).toContain('Sentinel files are protected');
  });

  it('should include matched policy names in decision', () => {
    bus.on('policy_check', () => {});
    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });

    const result = sentinel.intercept(
      makeAction({
        actionType: 'git_push',
        target: 'origin main',
        params: { force: true },
      }),
    );

    expect(result.allowed).toBe(false);
    expect(result.policyDecision.matchedPolicies.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════
// Scenario 8: 모든 행위 감사 기록
// ══════════════════════════════════════════════════
describe('Scenario 8: All actions audited', () => {
  it('should record allowed actions in audit store', () => {
    bus.on('policy_check', () => {});
    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });

    const result = sentinel.intercept(makeAction());

    expect(result.auditId).toBeDefined();
    const records = auditStore.query({ eventType: 'policy_check' });
    expect(records.length).toBeGreaterThanOrEqual(1);
    const found = records.find((r) => r.id === result.auditId);
    expect(found).toBeDefined();
    expect(found!.outcome).toBe('allowed');
  });

  it('should record blocked actions in audit store', () => {
    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });

    const result = sentinel.intercept(
      makeAction({ target: 'src/lib/autonomy/test.ts' }),
    );

    expect(result.auditId).toBeDefined();
    const records = auditStore.query({ eventType: 'policy_check' });
    const found = records.find((r) => r.id === result.auditId);
    expect(found).toBeDefined();
    expect(found!.outcome).toBe('blocked');
  });

  it('should emit policy_check event on EventBus', () => {
    const events: unknown[] = [];
    bus.on('policy_check', (event) => { events.push(event); });

    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });

    sentinel.intercept(makeAction());

    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});

// ══════════════════════════════════════════════════
// SecuritySentinel immutability
// ══════════════════════════════════════════════════
describe('SecuritySentinel immutability', () => {
  it('should return true for isImmutable()', () => {
    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });
    expect(sentinel.isImmutable()).toBe(true);
  });

  it('should return sentinel file list', () => {
    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });
    const files = sentinel.getSentinelFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain('src/lib/autonomy/SecuritySentinel.ts');
  });
});

// ══════════════════════════════════════════════════
// Module exports
// ══════════════════════════════════════════════════
describe('Phase 2 module exports', () => {
  it('should export all Phase 2 classes', async () => {
    const mod = await import('../index.js');
    expect(mod.RiskClassifier).toBeDefined();
    expect(mod.PolicyEngine).toBeDefined();
    expect(mod.SecuritySentinel).toBeDefined();
    expect(mod.isSentinelProtectedPath).toBeDefined();
  });
});
