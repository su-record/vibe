import { describe, it, expect } from 'vitest';
import {
  createRequirementsCheckpoint,
  createArchitectureCheckpoint,
  createScopeCheckpoint,
  createVerificationCheckpoint,
  createFixStrategyCheckpoint,
  formatCheckpoint,
  resolveCheckpoint,
  autoResolveCheckpoint,
  createHistory,
  addToHistory,
} from '../InteractiveCheckpoint.js';

// ══════════════════════════════════════════════════
// createRequirementsCheckpoint
// ══════════════════════════════════════════════════
describe('createRequirementsCheckpoint', () => {
  it('should return type requirements_confirm', () => {
    const cp = createRequirementsCheckpoint(['req 1', 'req 2'], 'MyFeature');
    expect(cp.type).toBe('requirements_confirm');
  });

  it('should embed featureName in the summary', () => {
    const cp = createRequirementsCheckpoint(['auth flow'], 'LoginModule');
    expect(cp.summary).toContain('LoginModule');
  });

  it('should list all requirements in the summary', () => {
    const reqs = ['req A', 'req B', 'req C'];
    const cp = createRequirementsCheckpoint(reqs, 'F');
    for (const r of reqs) {
      expect(cp.summary).toContain(r);
    }
  });

  it('should have options a, b, c', () => {
    const cp = createRequirementsCheckpoint(['r'], 'F');
    expect(cp.options.map(o => o.key)).toEqual(['a', 'b', 'c']);
  });

  it('should default to option a', () => {
    const cp = createRequirementsCheckpoint(['r'], 'F');
    expect(cp.defaultOption).toBe('a');
  });

  it('should store requirementCount in metadata', () => {
    const cp = createRequirementsCheckpoint(['r1', 'r2', 'r3'], 'F');
    expect(cp.metadata['requirementCount']).toBe(3);
  });
});

// ══════════════════════════════════════════════════
// createArchitectureCheckpoint
// ══════════════════════════════════════════════════
describe('createArchitectureCheckpoint', () => {
  const approaches = [
    { approach: 'Simple inline', pros: ['fast'], cons: ['messy'], effort: 'low' },
    { approach: 'Layered design', pros: ['clean'], cons: ['slower'], effort: 'medium' },
    { approach: 'Full DDD', pros: ['scalable'], cons: ['complex'], effort: 'high' },
  ];

  it('should return type architecture_choice', () => {
    const cp = createArchitectureCheckpoint(approaches);
    expect(cp.type).toBe('architecture_choice');
  });

  it('should produce exactly 3 options', () => {
    const cp = createArchitectureCheckpoint(approaches);
    expect(cp.options).toHaveLength(3);
  });

  it('should label options with Minimal, Clean, Pragmatic', () => {
    const cp = createArchitectureCheckpoint(approaches);
    expect(cp.options[0].label).toContain('Minimal');
    expect(cp.options[1].label).toContain('Clean');
    expect(cp.options[2].label).toContain('Pragmatic');
  });

  it('should include effort in option labels', () => {
    const cp = createArchitectureCheckpoint(approaches);
    expect(cp.options[0].label).toContain('low');
    expect(cp.options[1].label).toContain('medium');
    expect(cp.options[2].label).toContain('high');
  });

  it('should default to option b (balanced)', () => {
    const cp = createArchitectureCheckpoint(approaches);
    expect(cp.defaultOption).toBe('b');
  });

  it('should include pros and cons in option descriptions', () => {
    const cp = createArchitectureCheckpoint(approaches);
    expect(cp.options[0].description).toContain('fast');
    expect(cp.options[0].description).toContain('messy');
  });

  it('should cap to 3 options even when more are provided', () => {
    const extra = [
      ...approaches,
      { approach: 'Microservices', pros: ['flex'], cons: ['ops burden'], effort: 'very high' },
    ];
    const cp = createArchitectureCheckpoint(extra);
    expect(cp.options).toHaveLength(3);
  });
});

// ══════════════════════════════════════════════════
// createScopeCheckpoint
// ══════════════════════════════════════════════════
describe('createScopeCheckpoint', () => {
  const files = [
    { path: 'src/auth.ts', action: 'create' as const },
    { path: 'src/index.ts', action: 'modify' as const },
    { path: 'src/old.ts', action: 'delete' as const },
  ];

  it('should return type implementation_scope', () => {
    const cp = createScopeCheckpoint(files, 200);
    expect(cp.type).toBe('implementation_scope');
  });

  it('should include estimatedLines in the summary', () => {
    const cp = createScopeCheckpoint(files, 350);
    expect(cp.summary).toContain('350');
  });

  it('should list each file path in the summary', () => {
    const cp = createScopeCheckpoint(files, 100);
    for (const f of files) {
      expect(cp.summary).toContain(f.path);
    }
  });

  it('should have options a, b, c', () => {
    const cp = createScopeCheckpoint(files, 100);
    expect(cp.options.map(o => o.key)).toEqual(['a', 'b', 'c']);
  });

  it('should default to option a', () => {
    const cp = createScopeCheckpoint(files, 100);
    expect(cp.defaultOption).toBe('a');
  });

  it('should store fileCount and estimatedLines in metadata', () => {
    const cp = createScopeCheckpoint(files, 42);
    expect(cp.metadata['fileCount']).toBe(3);
    expect(cp.metadata['estimatedLines']).toBe(42);
  });
});

// ══════════════════════════════════════════════════
// createVerificationCheckpoint
// ══════════════════════════════════════════════════
describe('createVerificationCheckpoint', () => {
  it('should return type verification_result', () => {
    const cp = createVerificationCheckpoint(0.8, ['req 1 failed'], 2);
    expect(cp.type).toBe('verification_result');
  });

  it('should include achievement rate percentage in summary', () => {
    const cp = createVerificationCheckpoint(0.75, [], 1);
    expect(cp.summary).toContain('75%');
  });

  it('should list failed requirements in summary', () => {
    const failed = ['login must work', 'logout must work'];
    const cp = createVerificationCheckpoint(0.5, failed, 1);
    for (const r of failed) {
      expect(cp.summary).toContain(r);
    }
  });

  it('should default to a (continue fixing) when there are failures', () => {
    const cp = createVerificationCheckpoint(0.6, ['something failed'], 1);
    expect(cp.defaultOption).toBe('a');
  });

  it('should default to b (accept as-is) when all pass', () => {
    const cp = createVerificationCheckpoint(1.0, [], 1);
    expect(cp.defaultOption).toBe('b');
  });

  it('should include iteration in summary', () => {
    const cp = createVerificationCheckpoint(0.9, [], 3);
    expect(cp.summary).toContain('3');
  });

  it('should store failedCount in metadata', () => {
    const cp = createVerificationCheckpoint(0.5, ['a', 'b'], 1);
    expect(cp.metadata['failedCount']).toBe(2);
  });
});

// ══════════════════════════════════════════════════
// createFixStrategyCheckpoint
// ══════════════════════════════════════════════════
describe('createFixStrategyCheckpoint', () => {
  const issues = [
    { severity: 'critical' as const, description: 'Null pointer crash' },
    { severity: 'warning' as const, description: 'Unused import' },
    { severity: 'info' as const, description: 'Missing JSDoc' },
  ];

  it('should return type fix_strategy', () => {
    const cp = createFixStrategyCheckpoint(issues);
    expect(cp.type).toBe('fix_strategy');
  });

  it('should list counts of each severity in summary', () => {
    const cp = createFixStrategyCheckpoint(issues);
    expect(cp.summary).toContain('1 critical');
    expect(cp.summary).toContain('1 warning');
    expect(cp.summary).toContain('1 info');
  });

  it('should list issue descriptions in summary', () => {
    const cp = createFixStrategyCheckpoint(issues);
    expect(cp.summary).toContain('Null pointer crash');
    expect(cp.summary).toContain('Unused import');
    expect(cp.summary).toContain('Missing JSDoc');
  });

  it('should have options: fix all, critical only, accept as-is', () => {
    const cp = createFixStrategyCheckpoint(issues);
    const labels = cp.options.map(o => o.label.toLowerCase());
    expect(labels.some(l => l.includes('fix all'))).toBe(true);
    expect(labels.some(l => l.includes('critical only'))).toBe(true);
    expect(labels.some(l => l.includes('accept as-is'))).toBe(true);
  });

  it('should default to a when there are critical issues', () => {
    const cp = createFixStrategyCheckpoint([{ severity: 'critical', description: 'crash' }]);
    expect(cp.defaultOption).toBe('a');
  });

  it('should default to c when there are no critical issues', () => {
    const cp = createFixStrategyCheckpoint([{ severity: 'info', description: 'docs' }]);
    expect(cp.defaultOption).toBe('c');
  });

  it('should store severity counts in metadata', () => {
    const cp = createFixStrategyCheckpoint(issues);
    expect(cp.metadata['criticalCount']).toBe(1);
    expect(cp.metadata['warningCount']).toBe(1);
    expect(cp.metadata['infoCount']).toBe(1);
  });
});

// ══════════════════════════════════════════════════
// formatCheckpoint
// ══════════════════════════════════════════════════
describe('formatCheckpoint', () => {
  it('should include the checkpoint title', () => {
    const cp = createRequirementsCheckpoint(['r'], 'TestFeature');
    const formatted = formatCheckpoint(cp);
    expect(formatted).toContain('Requirements Confirmation');
  });

  it('should include the summary text', () => {
    const cp = createRequirementsCheckpoint(['req 1'], 'MyApp');
    const formatted = formatCheckpoint(cp);
    expect(formatted).toContain('req 1');
  });

  it('should list all option keys', () => {
    const cp = createScopeCheckpoint(
      [{ path: 'src/x.ts', action: 'create' }],
      100
    );
    const formatted = formatCheckpoint(cp);
    expect(formatted).toContain('a)');
    expect(formatted).toContain('b)');
    expect(formatted).toContain('c)');
  });

  it('should mention the default option', () => {
    const cp = createRequirementsCheckpoint(['r'], 'F');
    const formatted = formatCheckpoint(cp);
    expect(formatted).toContain('Default: a');
  });

  it('should include option descriptions', () => {
    const cp = createRequirementsCheckpoint(['r'], 'F');
    const formatted = formatCheckpoint(cp);
    expect(formatted).toContain('Proceed with these requirements');
  });
});

// ══════════════════════════════════════════════════
// resolveCheckpoint
// ══════════════════════════════════════════════════
describe('resolveCheckpoint', () => {
  it('should return a result with the selected option', () => {
    const cp = createRequirementsCheckpoint(['r'], 'F');
    const result = resolveCheckpoint(cp, 'b');
    expect(result.selectedOption).toBe('b');
  });

  it('should set autoResolved to false', () => {
    const cp = createRequirementsCheckpoint(['r'], 'F');
    const result = resolveCheckpoint(cp, 'a');
    expect(result.autoResolved).toBe(false);
  });

  it('should set the correct checkpoint type', () => {
    const cp = createRequirementsCheckpoint(['r'], 'F');
    const result = resolveCheckpoint(cp, 'a');
    expect(result.type).toBe('requirements_confirm');
  });

  it('should set a valid ISO timestamp', () => {
    const cp = createRequirementsCheckpoint(['r'], 'F');
    const result = resolveCheckpoint(cp, 'a');
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('should throw for an invalid option key', () => {
    const cp = createRequirementsCheckpoint(['r'], 'F');
    expect(() => resolveCheckpoint(cp, 'z')).toThrow(/invalid option key/i);
  });

  it('should throw and mention valid keys in error message', () => {
    const cp = createRequirementsCheckpoint(['r'], 'F');
    expect(() => resolveCheckpoint(cp, 'x')).toThrow(/a, b, c/);
  });
});

// ══════════════════════════════════════════════════
// autoResolveCheckpoint
// ══════════════════════════════════════════════════
describe('autoResolveCheckpoint', () => {
  it('should select the defaultOption', () => {
    const cp = createArchitectureCheckpoint([
      { approach: 'A', pros: [], cons: [], effort: 'low' },
      { approach: 'B', pros: [], cons: [], effort: 'medium' },
      { approach: 'C', pros: [], cons: [], effort: 'high' },
    ]);
    const result = autoResolveCheckpoint(cp);
    expect(result.selectedOption).toBe(cp.defaultOption);
  });

  it('should set autoResolved to true', () => {
    const cp = createRequirementsCheckpoint(['r'], 'F');
    const result = autoResolveCheckpoint(cp);
    expect(result.autoResolved).toBe(true);
  });

  it('should set a valid ISO timestamp', () => {
    const cp = createRequirementsCheckpoint(['r'], 'F');
    const result = autoResolveCheckpoint(cp);
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('should carry the correct type', () => {
    const cp = createFixStrategyCheckpoint([{ severity: 'critical', description: 'crash' }]);
    const result = autoResolveCheckpoint(cp);
    expect(result.type).toBe('fix_strategy');
  });
});

// ══════════════════════════════════════════════════
// History tracking
// ══════════════════════════════════════════════════
describe('createHistory', () => {
  it('should create history with correct feature name', () => {
    const h = createHistory('MyFeature');
    expect(h.feature).toBe('MyFeature');
  });

  it('should start with an empty results array', () => {
    const h = createHistory('X');
    expect(h.results).toEqual([]);
  });
});

describe('addToHistory', () => {
  it('should append a result to history', () => {
    const h = createHistory('F');
    const cp = createRequirementsCheckpoint(['r'], 'F');
    const result = resolveCheckpoint(cp, 'a');
    const h2 = addToHistory(h, result);
    expect(h2.results).toHaveLength(1);
    expect(h2.results[0]).toBe(result);
  });

  it('should not mutate the original history', () => {
    const h = createHistory('F');
    const cp = createRequirementsCheckpoint(['r'], 'F');
    const result = resolveCheckpoint(cp, 'a');
    addToHistory(h, result);
    expect(h.results).toHaveLength(0);
  });

  it('should accumulate multiple results', () => {
    let h = createHistory('F');
    const cp1 = createRequirementsCheckpoint(['r'], 'F');
    const cp2 = createScopeCheckpoint([{ path: 'x.ts', action: 'create' }], 50);
    h = addToHistory(h, resolveCheckpoint(cp1, 'a'));
    h = addToHistory(h, autoResolveCheckpoint(cp2));
    expect(h.results).toHaveLength(2);
  });

  it('should preserve feature name after adding', () => {
    const h = createHistory('FeatureX');
    const cp = createRequirementsCheckpoint(['r'], 'FeatureX');
    const h2 = addToHistory(h, resolveCheckpoint(cp, 'a'));
    expect(h2.feature).toBe('FeatureX');
  });

  it('should store result types correctly in history', () => {
    let h = createHistory('F');
    const req = createRequirementsCheckpoint(['r'], 'F');
    const fix = createFixStrategyCheckpoint([{ severity: 'critical', description: 'crash' }]);
    h = addToHistory(h, resolveCheckpoint(req, 'a'));
    h = addToHistory(h, autoResolveCheckpoint(fix));
    expect(h.results[0].type).toBe('requirements_confirm');
    expect(h.results[1].type).toBe('fix_strategy');
  });
});
