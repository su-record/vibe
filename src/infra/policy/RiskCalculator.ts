/**
 * RiskCalculator - Analyze ActionPlan risk
 * Phase 3: Policy Engine
 */

import { RiskLevel, RISK_ORDER, maxRisk } from './types.js';

export interface RiskInput {
  actions: Array<{
    type: string;
    target: string;
    command?: string;
  }>;
  estimatedFiles?: number;
}

const ACTION_TYPE_RISK: Record<string, RiskLevel> = {
  analyze_codebase: 'none',
  review: 'none',
  create_spec: 'none',
  test: 'low',
  implement: 'medium',
  refactor: 'medium',
  modify_config: 'medium',
  deploy: 'high',
  delete: 'high',
};

export class RiskCalculator {
  /** Calculate overall risk from actions */
  calculate(input: RiskInput): RiskLevel {
    let overall: RiskLevel = 'none';

    for (const action of input.actions) {
      const actionRisk = ACTION_TYPE_RISK[action.type] || 'low';
      overall = maxRisk(overall, actionRisk);

      // Check target for additional risk
      const targetRisk = this.assessTargetRisk(action.target);
      overall = maxRisk(overall, targetRisk);

      // Check command for additional risk
      if (action.command) {
        const cmdRisk = this.assessCommandRisk(action.command);
        overall = maxRisk(overall, cmdRisk);
      }
    }

    // Large number of files increases risk
    if (input.estimatedFiles && input.estimatedFiles > 10) {
      overall = maxRisk(overall, 'medium');
    }

    return overall;
  }

  private assessTargetRisk(target: string): RiskLevel {
    if (/^\/(etc|usr|bin|sbin|var|boot)\//.test(target)) return 'critical';
    if (target.includes('.ssh/')) return 'critical';
    if (/\.(env|credentials|secrets)/.test(target)) return 'high';
    if (/\.(config|rc|yml|yaml)$/.test(target)) return 'medium';
    return 'none';
  }

  private assessCommandRisk(command: string): RiskLevel {
    if (/rm\s+.*-.*r.*f/i.test(command)) return 'critical';
    if (/^\s*sudo\s/i.test(command)) return 'critical';
    if (/chmod\s+777/i.test(command)) return 'high';
    if (/git\s+push\s+.*--force/i.test(command)) return 'high';
    if (/npm\s+publish/i.test(command)) return 'medium';
    return 'none';
  }
}
