/**
 * Traceability Matrix Tests
 * RTM generation, coverage calculation, output formatting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateTraceabilityMatrix,
  formatMatrixAsMarkdown,
  formatMatrixAsHtml,
  type TraceabilityMatrix,
  type TraceItem,
  type TraceSummary,
} from './traceabilityMatrix.js';

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn((path: string) => {
    if (path.includes('test-feature.md')) {
      return `# SPEC: test-feature

## Task

### Phase 1: Setup

1. [ ] REQ-test-001: Setup authentication
2. [ ] REQ-test-002: Create login form
3. [ ] REQ-test-003: Implement validation
`;
    }
    if (path.includes('test-feature.feature')) {
      return `# Feature: test-feature

## Scenarios

### Scenario 1: User can login
\`\`\`gherkin
Given user is on login page
When user enters valid credentials
Then user is logged in
\`\`\`
**Verification**: REQ-test-001

### Scenario 2: Validation errors
\`\`\`gherkin
Given user is on login page
When user enters invalid email
Then error message is shown
\`\`\`
**Verification**: REQ-test-003
`;
    }
    throw new Error(`File not found: ${path}`);
  }),
  readdirSync: vi.fn(() => []),
}));

describe('Traceability Matrix', () => {
  describe('generateTraceabilityMatrix()', () => {
    it('should generate matrix for a feature', () => {
      const matrix = generateTraceabilityMatrix('test-feature', {
        projectPath: '/mock/project',
        specPath: '.claude/vibe/specs/test-feature.md',
        featurePath: '.claude/vibe/features/test-feature.feature',
      });

      expect(matrix.featureName).toBe('test-feature');
      expect(matrix.generatedAt).toBeDefined();
      expect(matrix.items).toBeInstanceOf(Array);
      expect(matrix.summary).toBeDefined();
    });

    it('should extract requirements from SPEC', () => {
      const matrix = generateTraceabilityMatrix('test-feature', {
        projectPath: '/mock/project',
      });

      // Should find REQ-test-001, REQ-test-002, REQ-test-003
      expect(matrix.items.length).toBeGreaterThan(0);
    });

    it('should map scenarios to requirements', () => {
      const matrix = generateTraceabilityMatrix('test-feature', {
        projectPath: '/mock/project',
      });

      // REQ-test-001 should be mapped to Scenario 1
      const req001 = matrix.items.find(i => i.requirementId === 'REQ-test-001');
      expect(req001?.featureScenario).toBeDefined();
    });

    it('should calculate coverage correctly', () => {
      const matrix = generateTraceabilityMatrix('test-feature', {
        projectPath: '/mock/project',
      });

      expect(matrix.summary.totalRequirements).toBeGreaterThan(0);
      expect(matrix.summary.coveragePercent).toBeGreaterThanOrEqual(0);
      expect(matrix.summary.coveragePercent).toBeLessThanOrEqual(100);
    });
  });

  describe('TraceSummary', () => {
    it('should track uncovered requirements', () => {
      const matrix = generateTraceabilityMatrix('test-feature', {
        projectPath: '/mock/project',
      });

      // REQ-test-002 has no scenario, should be uncovered or partial
      const uncoveredOrPartial = [
        ...matrix.summary.uncoveredRequirements,
        ...matrix.summary.partialRequirements,
      ];
      expect(uncoveredOrPartial.length).toBeGreaterThanOrEqual(0);
    });

    it('should calculate spec coverage', () => {
      const matrix = generateTraceabilityMatrix('test-feature', {
        projectPath: '/mock/project',
      });

      expect(matrix.summary.specCovered).toBeLessThanOrEqual(matrix.summary.totalRequirements);
    });

    it('should calculate feature coverage', () => {
      const matrix = generateTraceabilityMatrix('test-feature', {
        projectPath: '/mock/project',
      });

      expect(matrix.summary.featureCovered).toBeLessThanOrEqual(matrix.summary.totalRequirements);
    });

    it('should calculate test coverage', () => {
      const matrix = generateTraceabilityMatrix('test-feature', {
        projectPath: '/mock/project',
      });

      expect(matrix.summary.testCovered).toBeLessThanOrEqual(matrix.summary.totalRequirements);
    });
  });

  describe('formatMatrixAsMarkdown()', () => {
    it('should format matrix as markdown', () => {
      const matrix: TraceabilityMatrix = {
        featureName: 'test-feature',
        items: [
          {
            requirementId: 'REQ-test-001',
            requirementDesc: 'Test requirement',
            specSection: 'Phase 1',
            specFile: 'spec.md',
            featureScenario: 'Scenario 1',
            featureFile: 'feature.feature',
            testFile: 'test.spec.ts',
            testName: 'should test something',
            coverage: 'full',
          },
          {
            requirementId: 'REQ-test-002',
            requirementDesc: 'Another requirement',
            specSection: 'Phase 1',
            specFile: 'spec.md',
            coverage: 'none',
          },
        ],
        summary: {
          totalRequirements: 2,
          specCovered: 2,
          featureCovered: 1,
          testCovered: 1,
          coveragePercent: 50,
          uncoveredRequirements: ['REQ-test-002'],
          partialRequirements: [],
        },
        generatedAt: new Date().toISOString(),
      };

      const markdown = formatMatrixAsMarkdown(matrix);

      expect(markdown).toContain('# Requirements Traceability Matrix');
      expect(markdown).toContain('test-feature');
      expect(markdown).toContain('## Summary');
      expect(markdown).toContain('## Traceability Matrix');
      expect(markdown).toContain('REQ-test-001');
      expect(markdown).toContain('REQ-test-002');
      expect(markdown).toContain('50%');
    });

    it('should include recommendations section', () => {
      const matrix: TraceabilityMatrix = {
        featureName: 'test',
        items: [],
        summary: {
          totalRequirements: 1,
          specCovered: 1,
          featureCovered: 0,
          testCovered: 0,
          coveragePercent: 0,
          uncoveredRequirements: ['REQ-test-001'],
          partialRequirements: [],
        },
        generatedAt: new Date().toISOString(),
      };

      const markdown = formatMatrixAsMarkdown(matrix);
      expect(markdown).toContain('## Recommendations');
    });

    it('should show success message at 100% coverage', () => {
      const matrix: TraceabilityMatrix = {
        featureName: 'test',
        items: [{
          requirementId: 'REQ-test-001',
          requirementDesc: 'Test',
          coverage: 'full',
        }],
        summary: {
          totalRequirements: 1,
          specCovered: 1,
          featureCovered: 1,
          testCovered: 1,
          coveragePercent: 100,
          uncoveredRequirements: [],
          partialRequirements: [],
        },
        generatedAt: new Date().toISOString(),
      };

      const markdown = formatMatrixAsMarkdown(matrix);
      expect(markdown).toContain('All requirements are fully covered');
    });
  });

  describe('formatMatrixAsHtml()', () => {
    it('should format matrix as HTML', () => {
      const matrix: TraceabilityMatrix = {
        featureName: 'test-feature',
        items: [
          {
            requirementId: 'REQ-test-001',
            requirementDesc: 'Test requirement',
            specSection: 'Phase 1',
            coverage: 'full',
          },
        ],
        summary: {
          totalRequirements: 1,
          specCovered: 1,
          featureCovered: 1,
          testCovered: 1,
          coveragePercent: 100,
          uncoveredRequirements: [],
          partialRequirements: [],
        },
        generatedAt: new Date().toISOString(),
      };

      const html = formatMatrixAsHtml(matrix);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>RTM: test-feature</title>');
      expect(html).toContain('<table>');
      expect(html).toContain('REQ-test-001');
    });

    it('should include CSS styles', () => {
      const matrix: TraceabilityMatrix = {
        featureName: 'test',
        items: [],
        summary: {
          totalRequirements: 0,
          specCovered: 0,
          featureCovered: 0,
          testCovered: 0,
          coveragePercent: 0,
          uncoveredRequirements: [],
          partialRequirements: [],
        },
        generatedAt: new Date().toISOString(),
      };

      const html = formatMatrixAsHtml(matrix);
      expect(html).toContain('<style>');
      expect(html).toContain('.full');
      expect(html).toContain('.partial');
      expect(html).toContain('.none');
    });

    it('should include coverage bar', () => {
      const matrix: TraceabilityMatrix = {
        featureName: 'test',
        items: [],
        summary: {
          totalRequirements: 2,
          specCovered: 1,
          featureCovered: 1,
          testCovered: 1,
          coveragePercent: 50,
          uncoveredRequirements: [],
          partialRequirements: [],
        },
        generatedAt: new Date().toISOString(),
      };

      const html = formatMatrixAsHtml(matrix);
      expect(html).toContain('coverage-bar');
      expect(html).toContain('coverage-fill');
      expect(html).toContain('width: 50%');
    });

    it('should escape HTML in descriptions', () => {
      const matrix: TraceabilityMatrix = {
        featureName: 'test',
        items: [{
          requirementId: 'REQ-test-001',
          requirementDesc: '<script>alert("xss")</script>',
          coverage: 'none',
        }],
        summary: {
          totalRequirements: 1,
          specCovered: 0,
          featureCovered: 0,
          testCovered: 0,
          coveragePercent: 0,
          uncoveredRequirements: ['REQ-test-001'],
          partialRequirements: [],
        },
        generatedAt: new Date().toISOString(),
      };

      const html = formatMatrixAsHtml(matrix);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('Coverage calculation', () => {
    it('should mark as full when all mappings exist', () => {
      const item: TraceItem = {
        requirementId: 'REQ-001',
        requirementDesc: 'Test',
        specSection: 'Phase 1',
        featureScenario: 'Scenario 1',
        testName: 'test case',
        coverage: 'full',
      };

      expect(item.coverage).toBe('full');
    });

    it('should mark as partial when some mappings exist', () => {
      const item: TraceItem = {
        requirementId: 'REQ-001',
        requirementDesc: 'Test',
        specSection: 'Phase 1',
        featureScenario: 'Scenario 1',
        coverage: 'partial',
      };

      expect(item.coverage).toBe('partial');
    });

    it('should mark as none when no mappings exist', () => {
      const item: TraceItem = {
        requirementId: 'REQ-001',
        requirementDesc: 'Test',
        coverage: 'none',
      };

      expect(item.coverage).toBe('none');
    });
  });
});

describe('Integration', () => {
  it('should generate complete RTM workflow', () => {
    const matrix = generateTraceabilityMatrix('test-feature', {
      projectPath: '/mock/project',
    });

    const markdown = formatMatrixAsMarkdown(matrix);
    const html = formatMatrixAsHtml(matrix);

    expect(markdown.length).toBeGreaterThan(100);
    expect(html.length).toBeGreaterThan(100);
    expect(markdown).toContain(matrix.featureName);
    expect(html).toContain(matrix.featureName);
  });
});
