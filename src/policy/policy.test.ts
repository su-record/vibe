/**
 * Phase 3: Policy Engine Tests (13 Scenarios)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { PolicyEngine } from './PolicyEngine.js';
import { PolicyStore } from './PolicyStore.js';
import { RiskCalculator } from './RiskCalculator.js';
import { EvidenceStore } from './Evidence.js';
import { EvalContext, maxRisk } from './types.js';
import { LogLevel } from '../daemon/types.js';

const TEST_DIR = path.join(os.tmpdir(), `vibe-policy-test-${process.pid}`);
const noopLogger = (_level: LogLevel, _msg: string, _data?: unknown): void => {};

function makeTestDb(): string {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  return path.join(TEST_DIR, `test-${crypto.randomBytes(4).toString('hex')}.db`);
}

function makeContext(overrides: Partial<EvalContext> = {}): EvalContext {
  return {
    actions: [{ type: 'implement', target: 'src/config.ts' }],
    projectPath: '/test/project',
    riskLevel: 'none',
    ...overrides,
  };
}

let store: PolicyStore;
let evidence: EvidenceStore;
let engine: PolicyEngine;

// ============================================================================
// Scenario 1: Evaluate ActionPlan against policy
// ============================================================================

describe('Scenario 1: Evaluate ActionPlan', () => {
  beforeEach(() => {
    store = new PolicyStore(noopLogger);
    store.loadAll();
    evidence = new EvidenceStore(noopLogger, makeTestDb());
    engine = new PolicyEngine(store, evidence, noopLogger);
  });

  afterEach(() => {
    evidence.close();
  });

  it('should return decision, risk level, and reasons', () => {
    const ctx = makeContext({
      actions: [{ type: 'implement', target: 'src/config.ts' }],
    });

    const result = engine.evaluate(ctx);

    expect(result.decision).toBeDefined();
    expect(['approve', 'warn', 'reject']).toContain(result.decision);
    expect(result.riskLevel).toBeDefined();
    expect(result.reasons).toBeInstanceOf(Array);
    expect(result.requiresApproval).toBeDefined();
    expect(result.suggestions).toBeInstanceOf(Array);
  });

  it('should approve safe file modifications', () => {
    const ctx = makeContext({
      actions: [{ type: 'implement', target: 'src/utils.ts' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.decision).toBe('approve');
  });
});

// ============================================================================
// Scenario 2: Block dangerous file operations
// ============================================================================

describe('Scenario 2: Block system path modification', () => {
  beforeEach(() => {
    store = new PolicyStore(noopLogger);
    store.loadAll();
    evidence = new EvidenceStore(noopLogger, makeTestDb());
    engine = new PolicyEngine(store, evidence, noopLogger);
  });

  afterEach(() => {
    evidence.close();
  });

  it('should reject modifications to /etc/', () => {
    const ctx = makeContext({
      actions: [{ type: 'modify_config', target: '/etc/hosts' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.decision).toBe('reject');
    expect(result.reasons.some((r) => r.ruleId === 'fs-001')).toBe(true);
  });

  it('should reject modifications to /usr/', () => {
    const ctx = makeContext({
      actions: [{ type: 'implement', target: '/usr/bin/test' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.decision).toBe('reject');
  });

  it('should reject SSH key modifications', () => {
    const ctx = makeContext({
      actions: [{ type: 'implement', target: '/home/user/.ssh/id_rsa' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.decision).toBe('reject');
    expect(result.reasons.some((r) => r.ruleId === 'fs-002')).toBe(true);
  });
});

// ============================================================================
// Scenario 3: Warn on sensitive file modification
// ============================================================================

describe('Scenario 3: Warn on .env file modification', () => {
  beforeEach(() => {
    store = new PolicyStore(noopLogger);
    store.loadAll();
    evidence = new EvidenceStore(noopLogger, makeTestDb());
    engine = new PolicyEngine(store, evidence, noopLogger);
  });

  afterEach(() => {
    evidence.close();
  });

  it('should warn on .env file', () => {
    const ctx = makeContext({
      actions: [{ type: 'implement', target: '.env' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.decision).toBe('warn');
    expect(result.reasons.some((r) => r.ruleId === 'fs-003')).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it('should warn on .env.local file', () => {
    const ctx = makeContext({
      actions: [{ type: 'implement', target: '.env.local' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.decision).toBe('warn');
  });

  it('should warn on credentials file', () => {
    const ctx = makeContext({
      actions: [{ type: 'implement', target: 'credentials.json' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.decision).toBe('warn');
    expect(result.reasons.some((r) => r.ruleId === 'fs-004')).toBe(true);
  });
});

// ============================================================================
// Scenario 4: Block dangerous commands
// ============================================================================

describe('Scenario 4: Block rm -rf command', () => {
  beforeEach(() => {
    store = new PolicyStore(noopLogger);
    store.loadAll();
    evidence = new EvidenceStore(noopLogger, makeTestDb());
    engine = new PolicyEngine(store, evidence, noopLogger);
  });

  afterEach(() => {
    evidence.close();
  });

  it('should reject rm -rf', () => {
    const ctx = makeContext({
      actions: [{ type: 'implement', target: 'cleanup.sh', command: 'rm -rf /tmp/data' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.decision).toBe('reject');
    expect(result.reasons.some((r) => r.ruleId === 'cs-001')).toBe(true);
  });

  it('should reject sudo commands', () => {
    const ctx = makeContext({
      actions: [{ type: 'implement', target: 'setup.sh', command: 'sudo apt install' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.decision).toBe('reject');
    expect(result.reasons.some((r) => r.ruleId === 'cs-002')).toBe(true);
  });

  it('should reject chmod 777', () => {
    const ctx = makeContext({
      actions: [{ type: 'implement', target: 'setup.sh', command: 'chmod 777 /var/app' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.decision).toBe('reject');
    expect(result.reasons.some((r) => r.ruleId === 'cs-003')).toBe(true);
  });
});

// ============================================================================
// Scenario 5: Warn on force push
// ============================================================================

describe('Scenario 5: Warn on git push --force', () => {
  beforeEach(() => {
    store = new PolicyStore(noopLogger);
    store.loadAll();
    evidence = new EvidenceStore(noopLogger, makeTestDb());
    engine = new PolicyEngine(store, evidence, noopLogger);
  });

  afterEach(() => {
    evidence.close();
  });

  it('should warn on git push --force', () => {
    const ctx = makeContext({
      actions: [{ type: 'implement', target: 'deploy.sh', command: 'git push origin main --force' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.decision).toBe('warn');
    expect(result.reasons.some((r) => r.ruleId === 'cs-004')).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it('should warn on npm publish', () => {
    const ctx = makeContext({
      actions: [{ type: 'implement', target: 'release.sh', command: 'npm publish --access public' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.decision).toBe('warn');
    expect(result.reasons.some((r) => r.ruleId === 'cs-005')).toBe(true);
  });
});

// ============================================================================
// Scenario 6: Calculate risk level
// ============================================================================

describe('Scenario 6: Calculate overall risk level', () => {
  it('should return highest risk among actions', () => {
    const calculator = new RiskCalculator();

    const result = calculator.calculate({
      actions: [
        { type: 'test', target: 'src/test.ts' },
        { type: 'implement', target: 'src/main.ts' },
      ],
    });

    expect(result).toBe('medium'); // test=low, implement=medium → medium
  });

  it('should elevate risk for system paths', () => {
    const calculator = new RiskCalculator();

    const result = calculator.calculate({
      actions: [{ type: 'test', target: '/etc/config' }],
    });

    expect(result).toBe('critical');
  });

  it('should elevate risk for dangerous commands', () => {
    const calculator = new RiskCalculator();

    const result = calculator.calculate({
      actions: [{ type: 'test', target: 'script.sh', command: 'sudo rm -rf /tmp' }],
    });

    expect(result).toBe('critical');
  });

  it('should elevate risk for large file counts', () => {
    const calculator = new RiskCalculator();

    const result = calculator.calculate({
      actions: [{ type: 'test', target: 'src/app.ts' }],
      estimatedFiles: 15,
    });

    expect(result).toBe('medium'); // test=low, 15 files→medium → medium
  });

  it('maxRisk should return the higher risk', () => {
    expect(maxRisk('low', 'medium')).toBe('medium');
    expect(maxRisk('critical', 'none')).toBe('critical');
    expect(maxRisk('high', 'high')).toBe('high');
  });
});

// ============================================================================
// Scenario 7: Record Evidence
// ============================================================================

describe('Scenario 7: Record policy evaluation as Evidence', () => {
  let evidenceStore: EvidenceStore;

  beforeEach(() => {
    evidenceStore = new EvidenceStore(noopLogger, makeTestDb());
  });

  afterEach(() => {
    evidenceStore.close();
  });

  it('should record evaluation evidence with decision and reasons', () => {
    store = new PolicyStore(noopLogger);
    store.loadAll();
    engine = new PolicyEngine(store, evidenceStore, noopLogger);

    const ctx = makeContext({
      actions: [{ type: 'implement', target: '.env' }],
    });

    const jobId = 'job-test-123';
    engine.evaluate(ctx, jobId);

    const records = evidenceStore.getByJob(jobId);
    expect(records.length).toBeGreaterThanOrEqual(1);

    const record = records[0];
    expect(record.jobId).toBe(jobId);
    expect(record.eventType).toBe('policy_evaluation');
    expect(record.decision).toBeDefined();
    expect(record.createdAt).toBeDefined();
    expect(record.payload).toBeDefined();
  });

  it('should mask sensitive data in evidence', () => {
    const id = evidenceStore.record({
      jobId: 'job-mask-test',
      eventType: 'policy_evaluation',
      decision: 'approve',
      payload: { apiKey: 'sk-abcdefghijklmnopqrstuvwxyz123456' },
      actor: 'test',
      source: 'test',
    });

    const records = evidenceStore.getByJob('job-mask-test');
    expect(records.length).toBe(1);

    const payload = records[0].payload;
    expect(JSON.stringify(payload)).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456');
    expect(JSON.stringify(payload)).toContain('***REDACTED***');
  });

  it('should retrieve evidence by type', () => {
    evidenceStore.record({
      jobId: 'job-type-test',
      eventType: 'policy_evaluation',
      decision: 'warn',
      payload: {},
      actor: 'test',
      source: 'test',
    });

    const records = evidenceStore.getByType('policy_evaluation');
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(records[0].eventType).toBe('policy_evaluation');
  });

  it('should clean up old evidence', () => {
    evidenceStore.record({
      jobId: 'old-job',
      eventType: 'policy_evaluation',
      decision: 'approve',
      payload: {},
      actor: 'test',
      source: 'test',
    });

    // Cleanup with -1 days (cutoff = tomorrow) should remove everything
    const deleted = evidenceStore.cleanup(-1);
    expect(deleted).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Scenario 8: List policies via CLI
// ============================================================================

describe('Scenario 8: List all policies', () => {
  it('should load built-in policies', () => {
    const policyStore = new PolicyStore(noopLogger);
    policyStore.loadAll();

    const all = policyStore.getAll();
    expect(all.length).toBeGreaterThanOrEqual(3);

    const names = all.map((p) => p.name);
    expect(names).toContain('file-safety');
    expect(names).toContain('command-safety');
    expect(names).toContain('resource-limit');
  });

  it('should identify safety vs config policies', () => {
    const policyStore = new PolicyStore(noopLogger);
    policyStore.loadAll();

    const safety = policyStore.getSafetyPolicies();
    const config = policyStore.getConfigPolicies();

    expect(safety.some((p) => p.name === 'file-safety')).toBe(true);
    expect(safety.some((p) => p.name === 'command-safety')).toBe(true);
    expect(config.some((p) => p.name === 'resource-limit')).toBe(true);
  });
});

// ============================================================================
// Scenario 9: Enable/disable policy
// ============================================================================

describe('Scenario 9: Disable a policy', () => {
  it('should disable configuration policy', () => {
    const policyStore = new PolicyStore(noopLogger);
    policyStore.loadAll();

    expect(policyStore.isEnabled('resource-limit')).toBe(true);

    const result = policyStore.disablePolicy('resource-limit');
    expect(result).toBe(true);
    expect(policyStore.isEnabled('resource-limit')).toBe(false);
  });

  it('should not disable safety policy', () => {
    const policyStore = new PolicyStore(noopLogger);
    policyStore.loadAll();

    const result = policyStore.disablePolicy('file-safety');
    expect(result).toBe(false);
    expect(policyStore.isEnabled('file-safety')).toBe(true);
  });

  it('should re-enable disabled policy', () => {
    const policyStore = new PolicyStore(noopLogger);
    policyStore.loadAll();

    policyStore.disablePolicy('resource-limit');
    expect(policyStore.isEnabled('resource-limit')).toBe(false);

    policyStore.enablePolicy('resource-limit');
    expect(policyStore.isEnabled('resource-limit')).toBe(true);
  });

  it('disabled config policy should not appear in active list', () => {
    const policyStore = new PolicyStore(noopLogger);
    policyStore.loadAll();

    policyStore.disablePolicy('resource-limit');

    const active = policyStore.getActive();
    expect(active.some((p) => p.name === 'resource-limit')).toBe(false);
  });
});

// ============================================================================
// Scenario 10: User custom policy
// ============================================================================

describe('Scenario 10: Load user-defined policy', () => {
  const testPoliciesDir = path.join(TEST_DIR, 'custom-policies');

  beforeEach(() => {
    if (!fs.existsSync(testPoliciesDir)) {
      fs.mkdirSync(testPoliciesDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testPoliciesDir)) {
      fs.rmSync(testPoliciesDir, { recursive: true, force: true });
    }
  });

  it('should load custom project policy', () => {
    const projectDir = path.join(testPoliciesDir, 'project');
    const policiesDir = path.join(projectDir, '.vibe', 'policies');
    fs.mkdirSync(policiesDir, { recursive: true });

    fs.writeFileSync(
      path.join(policiesDir, 'no-deploy.json'),
      JSON.stringify({
        name: 'no-deploy',
        version: '1.0.0',
        type: 'configuration',
        enabled: true,
        rules: [
          {
            id: 'nd-001',
            description: 'Block deploy actions',
            condition: { 'action.type': { equals: 'deploy' } },
            effect: 'reject',
            message: 'Deployment is not allowed in this project',
            severity: 'high',
          },
        ],
      })
    );

    const policyStore = new PolicyStore(noopLogger);
    policyStore.loadAll(projectDir);

    const policy = policyStore.getPolicy('no-deploy');
    expect(policy).toBeDefined();
    expect(policy?.source).toBe('project');
    expect(policy?.rules.length).toBe(1);
  });
});

// ============================================================================
// Scenario 11: Policy priority (project > user > builtin)
// ============================================================================

describe('Scenario 11: Project policy overrides user policy', () => {
  const testPoliciesDir = path.join(TEST_DIR, 'priority-test');

  beforeEach(() => {
    if (!fs.existsSync(testPoliciesDir)) {
      fs.mkdirSync(testPoliciesDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testPoliciesDir)) {
      fs.rmSync(testPoliciesDir, { recursive: true, force: true });
    }
  });

  it('should have project policy override same-name builtin', () => {
    const projectDir = path.join(testPoliciesDir, 'project');
    const policiesDir = path.join(projectDir, '.vibe', 'policies');
    fs.mkdirSync(policiesDir, { recursive: true });

    // Project-level override of resource-limit with stricter rules
    fs.writeFileSync(
      path.join(policiesDir, 'resource-limit.json'),
      JSON.stringify({
        name: 'resource-limit',
        version: '2.0.0',
        type: 'configuration',
        enabled: true,
        rules: [
          {
            id: 'rl-project-001',
            description: 'Strict: warn on any deploy',
            condition: { 'action.type': { equals: 'deploy' } },
            effect: 'reject',
            message: 'Project policy: deploy not allowed',
            severity: 'high',
          },
        ],
      })
    );

    const policyStore = new PolicyStore(noopLogger);
    policyStore.loadAll(projectDir);

    const policy = policyStore.getPolicy('resource-limit');
    expect(policy).toBeDefined();
    expect(policy?.source).toBe('project');
    expect(policy?.version).toBe('2.0.0');
    expect(policy?.rules[0].id).toBe('rl-project-001');
  });

  it('project reject should override builtin approve for same context', () => {
    const projectDir = path.join(testPoliciesDir, 'project2');
    const policiesDir = path.join(projectDir, '.vibe', 'policies');
    fs.mkdirSync(policiesDir, { recursive: true });

    fs.writeFileSync(
      path.join(policiesDir, 'no-deploy.json'),
      JSON.stringify({
        name: 'no-deploy',
        version: '1.0.0',
        type: 'configuration',
        enabled: true,
        rules: [
          {
            id: 'nd-001',
            description: 'Block production deploy',
            condition: { 'action.type': { equals: 'deploy' } },
            effect: 'reject',
            message: 'Production deploy blocked by project policy',
            severity: 'high',
          },
        ],
      })
    );

    const policyStore = new PolicyStore(noopLogger);
    policyStore.loadAll(projectDir);
    const evidenceStore = new EvidenceStore(noopLogger, makeTestDb());
    const policyEngine = new PolicyEngine(policyStore, evidenceStore, noopLogger);

    const ctx = makeContext({
      actions: [{ type: 'deploy', target: 'production' }],
    });

    const result = policyEngine.evaluate(ctx);
    expect(result.decision).toBe('reject');
    expect(result.reasons.some((r) => r.ruleId === 'nd-001')).toBe(true);

    evidenceStore.close();
  });
});

// ============================================================================
// Scenario 12: Critical risk requires approval
// ============================================================================

describe('Scenario 12: Critical risk always requires approval', () => {
  beforeEach(() => {
    store = new PolicyStore(noopLogger);
    store.loadAll();
    evidence = new EvidenceStore(noopLogger, makeTestDb());
    engine = new PolicyEngine(store, evidence, noopLogger);
  });

  afterEach(() => {
    evidence.close();
  });

  it('should require approval for critical risk', () => {
    const ctx = makeContext({
      actions: [{ type: 'implement', target: '/etc/passwd' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.requiresApproval).toBe(true);
    expect(result.riskLevel).toBe('critical');
  });

  it('should require approval for high risk', () => {
    const ctx = makeContext({
      actions: [{ type: 'deploy', target: 'production' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.requiresApproval).toBe(true);
  });

  it('should not require approval for low risk', () => {
    const ctx = makeContext({
      actions: [{ type: 'test', target: 'src/test.ts' }],
    });

    const result = engine.evaluate(ctx);
    expect(result.requiresApproval).toBe(false);
  });
});

// ============================================================================
// Scenario 13: Handle corrupted policy file
// ============================================================================

describe('Scenario 13: Handle corrupted policy file gracefully', () => {
  const testPoliciesDir = path.join(TEST_DIR, 'corrupted-test');

  beforeEach(() => {
    if (!fs.existsSync(testPoliciesDir)) {
      fs.mkdirSync(testPoliciesDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testPoliciesDir)) {
      fs.rmSync(testPoliciesDir, { recursive: true, force: true });
    }
  });

  it('should skip corrupted JSON and still load valid policies', () => {
    const projectDir = path.join(testPoliciesDir, 'project');
    const policiesDir = path.join(projectDir, '.vibe', 'policies');
    fs.mkdirSync(policiesDir, { recursive: true });

    // Write corrupted JSON
    fs.writeFileSync(path.join(policiesDir, 'broken.json'), '{invalid json!!!');

    // Write valid policy alongside
    fs.writeFileSync(
      path.join(policiesDir, 'valid-policy.json'),
      JSON.stringify({
        name: 'valid-policy',
        version: '1.0.0',
        type: 'configuration',
        enabled: true,
        rules: [
          {
            id: 'vp-001',
            description: 'A valid rule',
            condition: { 'action.type': { equals: 'test' } },
            effect: 'approve',
            message: 'Test action approved',
            severity: 'low',
          },
        ],
      })
    );

    const warnings: string[] = [];
    const logCapture = (level: LogLevel, msg: string): void => {
      if (level === 'warn') warnings.push(msg);
    };

    const policyStore = new PolicyStore(logCapture);
    policyStore.loadAll(projectDir);

    // Corrupted file should trigger warning
    expect(warnings.some((w) => w.includes('broken.json'))).toBe(true);

    // Valid policy should still load
    const policy = policyStore.getPolicy('valid-policy');
    expect(policy).toBeDefined();
    expect(policy?.name).toBe('valid-policy');

    // Built-in policies should still be active
    const all = policyStore.getAll();
    expect(all.some((p) => p.name === 'file-safety')).toBe(true);
    expect(all.some((p) => p.name === 'command-safety')).toBe(true);
  });

  it('should skip policy with invalid structure', () => {
    const projectDir = path.join(testPoliciesDir, 'project2');
    const policiesDir = path.join(projectDir, '.vibe', 'policies');
    fs.mkdirSync(policiesDir, { recursive: true });

    // Valid JSON but missing required fields
    fs.writeFileSync(
      path.join(policiesDir, 'no-name.json'),
      JSON.stringify({ version: '1.0.0', rules: [] })
    );

    // Missing rules array
    fs.writeFileSync(
      path.join(policiesDir, 'no-rules.json'),
      JSON.stringify({ name: 'no-rules', version: '1.0.0' })
    );

    const warnings: string[] = [];
    const logCapture = (level: LogLevel, msg: string): void => {
      if (level === 'warn') warnings.push(msg);
    };

    const policyStore = new PolicyStore(logCapture);
    policyStore.loadAll(projectDir);

    // Both invalid files should produce warnings
    expect(warnings.length).toBeGreaterThanOrEqual(2);
    expect(policyStore.getPolicy('no-rules')).toBeUndefined();
  });
});

// ============================================================================
// Cleanup
// ============================================================================

afterEach(() => {
  // Cleanup test directory
});

describe('Cleanup', () => {
  it('cleanup test files', () => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    expect(true).toBe(true);
  });
});
