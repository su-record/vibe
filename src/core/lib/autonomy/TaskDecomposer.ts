import { uuidv7 } from 'uuidv7';
import type { RiskLevel } from './schemas.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type StepType = 'spec' | 'review' | 'implement' | 'test' | 'deploy';
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
export type Complexity = 'low' | 'medium' | 'high';

export interface TaskStep {
  id: string;
  order: number;
  type: StepType;
  description: string;
  dependencies: string[];
  estimatedFiles: number;
  riskLevel: RiskLevel;
  status: StepStatus;
}

export interface DecomposedTask {
  id: string;
  originalPrompt: string;
  steps: TaskStep[];
  estimatedComplexity: Complexity;
  requiresConfirmation: boolean;
  createdAt: string;
}

export class CircularDependencyError extends Error {
  constructor(cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`);
    this.name = 'CircularDependencyError';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Keyword patterns for complexity estimation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const HIGH_COMPLEXITY_KEYWORDS = [
  'refactor', 'migration', 'architecture', 'redesign', 'overhaul',
  'rewrite', 'restructure', 'platform', 'infrastructure',
];

const MEDIUM_COMPLEXITY_KEYWORDS = [
  'add', 'create', 'implement', 'build', 'develop', 'feature',
  'integrate', 'setup', 'configure', 'module',
];

const LOW_COMPLEXITY_KEYWORDS = [
  'fix', 'update', 'change', 'modify', 'tweak', 'adjust',
  'rename', 'move', 'typo', 'patch', 'bump',
];

const HIGH_RISK_KEYWORDS = [
  'delete', 'remove', 'drop', 'destroy', 'force', 'reset',
  'auth', 'security', 'credential', 'password', 'token',
  'deploy', 'production', 'release', 'publish',
];

const FILE_INDICATOR_PATTERNS: Array<{ pattern: RegExp; estimate: number }> = [
  { pattern: /\b(?:full[- ]?stack|end[- ]?to[- ]?end|e2e)\b/i, estimate: 8 },
  { pattern: /\b(?:system|platform|service|api|server)\b/i, estimate: 6 },
  { pattern: /\b(?:feature|module|component|page|screen)\b/i, estimate: 4 },
  { pattern: /\b(?:function|method|handler|helper|util)\b/i, estimate: 2 },
  { pattern: /\b(?:fix|bug|typo|patch)\b/i, estimate: 1 },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TaskDecomposer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class TaskDecomposer {
  decompose(userPrompt: string): DecomposedTask {
    const normalized = userPrompt.trim();
    if (!normalized) {
      throw new Error('User prompt cannot be empty');
    }

    const estimatedFiles = this.estimateFileCount(normalized);
    const keywordComplexity = this.analyzeKeywordComplexity(normalized);
    const fileComplexity = this.fileCountToComplexity(estimatedFiles);
    const estimatedComplexity = this.resolveComplexity(keywordComplexity, fileComplexity);

    const stepTypes = this.determineStepTypes(estimatedFiles);
    const steps = this.buildSteps(stepTypes, normalized, estimatedFiles, estimatedComplexity);

    this.validateDAG(steps);

    const hasHighRisk = steps.some((s) => s.riskLevel === 'HIGH');

    return {
      id: uuidv7(),
      originalPrompt: normalized,
      steps,
      estimatedComplexity,
      requiresConfirmation: hasHighRisk,
      createdAt: new Date().toISOString(),
    };
  }

  private analyzeKeywordComplexity(prompt: string): Complexity {
    const lower = prompt.toLowerCase();

    for (const kw of HIGH_COMPLEXITY_KEYWORDS) {
      if (lower.includes(kw)) return 'high';
    }
    for (const kw of MEDIUM_COMPLEXITY_KEYWORDS) {
      if (lower.includes(kw)) return 'medium';
    }
    for (const kw of LOW_COMPLEXITY_KEYWORDS) {
      if (lower.includes(kw)) return 'low';
    }
    return 'medium';
  }

  private estimateFileCount(prompt: string): number {
    for (const { pattern, estimate } of FILE_INDICATOR_PATTERNS) {
      if (pattern.test(prompt)) return estimate;
    }
    return 3;
  }

  private fileCountToComplexity(fileCount: number): Complexity {
    if (fileCount <= 2) return 'low';
    if (fileCount <= 5) return 'medium';
    return 'high';
  }

  private resolveComplexity(keyword: Complexity, file: Complexity): Complexity {
    const order: Complexity[] = ['low', 'medium', 'high'];
    const kwIdx = order.indexOf(keyword);
    const fIdx = order.indexOf(file);
    return order[Math.max(kwIdx, fIdx)];
  }

  private determineStepTypes(estimatedFiles: number): StepType[] {
    if (estimatedFiles <= 2) {
      return ['implement', 'test'];
    }
    if (estimatedFiles <= 5) {
      return ['spec', 'implement', 'test'];
    }
    return ['spec', 'review', 'implement', 'test'];
  }

  private buildSteps(
    types: StepType[],
    prompt: string,
    estimatedFiles: number,
    complexity: Complexity,
  ): TaskStep[] {
    const hasHighRiskKeyword = HIGH_RISK_KEYWORDS.some((kw) =>
      prompt.toLowerCase().includes(kw),
    );

    return types.map((type, index) => {
      const stepId = uuidv7();
      const dependencies = index > 0 ? [types[index - 1]] : [];
      const riskLevel = this.assessStepRisk(type, hasHighRiskKeyword, complexity);

      return {
        id: stepId,
        order: index + 1,
        type,
        description: this.generateDescription(type, prompt),
        dependencies,
        estimatedFiles: type === 'implement' ? estimatedFiles : type === 'test' ? Math.ceil(estimatedFiles / 2) : 1,
        riskLevel,
        status: 'pending' as StepStatus,
      };
    });
  }

  private assessStepRisk(
    type: StepType,
    hasHighRiskKeyword: boolean,
    complexity: Complexity,
  ): RiskLevel {
    if (type === 'deploy') return 'HIGH';
    if (hasHighRiskKeyword && type === 'implement') return 'HIGH';
    if (complexity === 'high' && type === 'implement') return 'MEDIUM';
    if (type === 'implement') return 'LOW';
    return 'LOW';
  }

  private generateDescription(type: StepType, prompt: string): string {
    const truncated = prompt.length > 80 ? prompt.slice(0, 77) + '...' : prompt;
    const descriptions: Record<StepType, string> = {
      spec: `Generate SPEC document for: ${truncated}`,
      review: `Review SPEC and implementation plan for: ${truncated}`,
      implement: `Implement code changes for: ${truncated}`,
      test: `Write and run tests for: ${truncated}`,
      deploy: `Deploy changes for: ${truncated}`,
    };
    return descriptions[type];
  }

  validateDAG(steps: TaskStep[]): void {
    const typeToId = new Map<string, string>();
    for (const step of steps) {
      typeToId.set(step.type, step.id);
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (stepId: string, path: string[]): void => {
      if (inStack.has(stepId)) {
        throw new CircularDependencyError([...path, stepId]);
      }
      if (visited.has(stepId)) return;

      inStack.add(stepId);
      visited.add(stepId);

      const step = steps.find((s) => s.id === stepId);
      if (step) {
        for (const dep of step.dependencies) {
          const depId = typeToId.get(dep) ?? dep;
          dfs(depId, [...path, stepId]);
        }
      }

      inStack.delete(stepId);
    };

    for (const step of steps) {
      dfs(step.id, []);
    }
  }
}
