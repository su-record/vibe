/**
 * ActionPlanGenerator - Intent → ActionPlan
 * Phase 2: Job/Order System
 *
 * Generates step-by-step action plans from parsed intents
 */

import * as crypto from 'node:crypto';
import {
  ActionPlan,
  ActionStep,
  ParsedIntent,
  RiskLevel,
  nowISO,
} from './types.js';

/** Risk level mapping for action types */
const ACTION_RISK: Record<string, RiskLevel> = {
  analyze_codebase: 'none',
  create_spec: 'none',
  review: 'none',
  test: 'low',
  implement: 'medium',
  refactor: 'medium',
  deploy: 'high',
  delete: 'high',
  modify_config: 'medium',
};

/** Risk level ordering */
const RISK_ORDER: Record<RiskLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export class ActionPlanGenerator {
  /** Generate an action plan from parsed intent */
  generate(jobId: string, intent: ParsedIntent): ActionPlan {
    const actions = this.buildActions(intent);
    const riskLevel = this.calculateOverallRisk(actions);
    const estimatedFiles = this.estimateFileCount(intent);

    return {
      id: crypto.randomUUID(),
      jobId,
      intent,
      actions,
      riskLevel,
      confidence: intent.confidence,
      estimatedFiles,
      createdAt: nowISO(),
    };
  }

  /** Generate a minimal plan (fallback) */
  generateMinimal(jobId: string, intent: ParsedIntent): ActionPlan {
    const action: ActionStep = {
      id: crypto.randomUUID(),
      type: 'general',
      target: intent.projectPath,
      description: intent.summary,
      riskLevel: 'low',
    };

    return {
      id: crypto.randomUUID(),
      jobId,
      intent,
      actions: [action],
      riskLevel: 'low',
      confidence: 0.5,
      estimatedFiles: 1,
      createdAt: nowISO(),
    };
  }

  /** Build action steps from intent */
  private buildActions(intent: ParsedIntent): ActionStep[] {
    const actions: ActionStep[] = [];

    switch (intent.type) {
      case 'code':
        actions.push(this.makeStep('analyze_codebase', intent.projectPath, 'Analyze existing codebase'));
        if (intent.targets.length > 0) {
          for (const target of intent.targets) {
            actions.push(this.makeStep('implement', target, `Implement changes in ${target}`));
          }
        } else {
          actions.push(this.makeStep('implement', intent.projectPath, 'Implement requested feature'));
        }
        actions.push(this.makeStep('test', intent.projectPath, 'Run tests'));
        break;

      case 'fix':
        actions.push(this.makeStep('analyze_codebase', intent.projectPath, 'Analyze bug context'));
        actions.push(this.makeStep('implement', intent.targets[0] || intent.projectPath, 'Apply fix'));
        actions.push(this.makeStep('test', intent.projectPath, 'Verify fix'));
        break;

      case 'analyze':
        actions.push(this.makeStep('analyze_codebase', intent.projectPath, 'Deep analysis'));
        break;

      case 'review':
        actions.push(this.makeStep('review', intent.projectPath, 'Code review'));
        break;

      case 'test':
        actions.push(this.makeStep('analyze_codebase', intent.projectPath, 'Analyze test targets'));
        actions.push(this.makeStep('test', intent.projectPath, 'Generate and run tests'));
        break;

      case 'refactor':
        actions.push(this.makeStep('analyze_codebase', intent.projectPath, 'Analyze refactor scope'));
        actions.push(this.makeStep('refactor', intent.targets[0] || intent.projectPath, 'Apply refactoring'));
        actions.push(this.makeStep('test', intent.projectPath, 'Verify refactoring'));
        break;

      case 'deploy':
        actions.push(this.makeStep('test', intent.projectPath, 'Pre-deploy tests'));
        actions.push(this.makeStep('deploy', intent.projectPath, 'Deploy'));
        break;

      case 'docs':
        actions.push(this.makeStep('analyze_codebase', intent.projectPath, 'Analyze for documentation'));
        actions.push(this.makeStep('implement', intent.projectPath, 'Generate documentation'));
        break;

      default:
        actions.push(this.makeStep('analyze_codebase', intent.projectPath, 'Analyze request'));
        actions.push(this.makeStep('implement', intent.projectPath, 'Execute request'));
        break;
    }

    return actions;
  }

  private makeStep(type: string, target: string, description: string): ActionStep {
    return {
      id: crypto.randomUUID(),
      type,
      target,
      description,
      riskLevel: ACTION_RISK[type] || 'low',
    };
  }

  /** Calculate overall risk (highest of all actions) */
  private calculateOverallRisk(actions: ActionStep[]): RiskLevel {
    let maxRisk: RiskLevel = 'none';

    for (const action of actions) {
      if (RISK_ORDER[action.riskLevel] > RISK_ORDER[maxRisk]) {
        maxRisk = action.riskLevel;
      }
    }

    return maxRisk;
  }

  /** Estimate number of files affected */
  private estimateFileCount(intent: ParsedIntent): number {
    if (intent.targets.length > 0) return intent.targets.length;

    switch (intent.type) {
      case 'fix': return 2;
      case 'code': return 5;
      case 'refactor': return 4;
      case 'test': return 3;
      case 'analyze': return 0;
      case 'review': return 0;
      case 'deploy': return 1;
      case 'docs': return 2;
      default: return 1;
    }
  }
}
