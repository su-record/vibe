/**
 * PolicyEngine - Evaluate ActionPlans against policies
 * Phase 3: Policy Engine
 *
 * Two-stage evaluation:
 * 1. Safety policies (built-in): reject = immediate block
 * 2. Configuration policies: project > user > built-in
 */

import {
  PolicyFile,
  PolicyRule,
  PolicyCondition,
  EvalContext,
  EvaluationResult,
  EvaluationReason,
  PolicyDecision,
  PolicyEffect,
  RiskLevel,
  RISK_ORDER,
  maxRisk,
} from './types.js';
import { PolicyStore } from './PolicyStore.js';
import { RiskCalculator } from './RiskCalculator.js';
import { EvidenceStore } from './Evidence.js';
import { LogLevel } from '../daemon/types.js';

const MAX_REGEX_LENGTH = 100;
const REGEX_TIMEOUT_MS = 10;

export class PolicyEngine {
  private store: PolicyStore;
  private calculator: RiskCalculator;
  private evidence: EvidenceStore;
  private logger: (level: LogLevel, message: string, data?: unknown) => void;

  constructor(
    store: PolicyStore,
    evidence: EvidenceStore,
    logger: (level: LogLevel, message: string, data?: unknown) => void
  ) {
    this.store = store;
    this.calculator = new RiskCalculator();
    this.evidence = evidence;
    this.logger = logger;
  }

  /** Load policies */
  loadPolicies(projectPath?: string): void {
    this.store.loadAll(projectPath);
  }

  /** Evaluate an action plan against all active policies */
  evaluate(context: EvalContext, jobId?: string): EvaluationResult {
    const reasons: EvaluationReason[] = [];
    const suggestions: string[] = [];
    let overallRisk: RiskLevel = 'none';
    let decision: PolicyDecision = 'approve';

    // Stage 1: Safety policies (Deny-Override)
    const safetyPolicies = this.store.getSafetyPolicies();
    for (const policy of safetyPolicies) {
      for (const rule of policy.rules) {
        const matched = this.evaluateRule(rule, context, policy.type);
        if (matched) {
          reasons.push(matched);
          overallRisk = maxRisk(overallRisk, matched.severity);

          if (matched.effect === 'reject') {
            decision = 'reject'; // Safety reject cannot be overridden
          } else if (matched.effect === 'warn' && decision !== 'reject') {
            decision = 'warn';
          }
        }
      }
    }

    // Stage 2: Configuration policies (project > user > built-in)
    if (decision !== 'reject') {
      const configPolicies = this.store.getConfigPolicies();
      for (const policy of configPolicies) {
        for (const rule of policy.rules) {
          const matched = this.evaluateRule(rule, context, policy.type);
          if (matched) {
            reasons.push(matched);
            overallRisk = maxRisk(overallRisk, matched.severity);

            if (matched.effect === 'reject' && decision !== 'reject') {
              decision = 'reject';
            } else if (matched.effect === 'warn' && decision === 'approve') {
              decision = 'warn';
            }
          }
        }
      }
    }

    // Calculate risk from actions
    const calculatedRisk = this.calculator.calculate({
      actions: context.actions,
      estimatedFiles: context.metadata?.estimatedFiles as number | undefined,
    });
    overallRisk = maxRisk(overallRisk, calculatedRisk);

    // Critical risk always requires approval
    const requiresApproval = decision === 'warn' ||
      overallRisk === 'critical' ||
      overallRisk === 'high';

    if (reasons.length > 0) {
      suggestions.push('Review the policy evaluation reasons before proceeding');
    }

    const result: EvaluationResult = {
      decision,
      riskLevel: overallRisk,
      reasons,
      requiresApproval,
      suggestions,
    };

    // Record evidence
    if (jobId) {
      this.evidence.recordEvaluation(jobId, result);
    }

    this.logger('info', `Policy evaluation: ${decision} (risk: ${overallRisk})`, {
      reasons: reasons.length,
      requiresApproval,
    });

    return result;
  }

  /** Get the policy store */
  getPolicyStore(): PolicyStore {
    return this.store;
  }

  // ========================================================================
  // Private
  // ========================================================================

  /** Evaluate a single rule against context */
  private evaluateRule(
    rule: PolicyRule,
    context: EvalContext,
    policyType: 'safety' | 'configuration'
  ): EvaluationReason | null {
    const matched = this.matchCondition(rule.condition, context, policyType);

    if (matched) {
      return {
        rule: rule.description,
        ruleId: rule.id,
        message: rule.message,
        severity: rule.severity || 'medium',
        effect: rule.effect,
      };
    }

    return null;
  }

  /** Match a condition against context */
  private matchCondition(
    condition: PolicyCondition,
    context: EvalContext,
    policyType: 'safety' | 'configuration'
  ): boolean {
    // Handle $or
    if (condition.$or) {
      return condition.$or.some((c) => this.matchCondition(c, context, policyType));
    }

    // Handle $not
    if (condition.$not) {
      return !this.matchCondition(condition.$not, context, policyType);
    }

    // All other fields are implicit AND
    for (const [field, expected] of Object.entries(condition)) {
      if (field.startsWith('$')) continue;

      // For action-level fields, check against each action
      if (field.startsWith('action.')) {
        const actionField = field.slice(7); // Remove 'action.' prefix
        const anyMatch = context.actions.some((action) => {
          const value = action[actionField];
          if (value === undefined) {
            // Action-level: missing field = no match (pattern checks need a value)
            return false;
          }
          return this.matchValue(String(value), expected);
        });
        if (!anyMatch) return false;
      } else {
        // Top-level field
        const value = this.getContextValue(context, field);
        if (value === undefined) {
          return policyType === 'safety'; // Missing = fail-closed for safety
        }
        if (!this.matchValue(String(value), expected)) return false;
      }
    }

    return true;
  }

  /** Match a value against an expected pattern */
  private matchValue(value: string, expected: unknown): boolean {
    if (typeof expected === 'string') {
      return value === expected;
    }

    if (typeof expected === 'number') {
      return Number(value) === expected;
    }

    if (typeof expected === 'object' && expected !== null) {
      const ops = expected as Record<string, unknown>;

      if (ops.equals !== undefined) return value === String(ops.equals);
      if (ops.contains !== undefined) return value.includes(String(ops.contains));
      if (ops.gt !== undefined) return Number(value) > Number(ops.gt);
      if (ops.lt !== undefined) return Number(value) < Number(ops.lt);
      if (ops.in !== undefined && Array.isArray(ops.in)) {
        return ops.in.map(String).includes(value);
      }
      if (ops.not !== undefined) return !this.matchValue(value, ops.not);

      if (ops.regex !== undefined) {
        const pattern = String(ops.regex);
        if (pattern.length > MAX_REGEX_LENGTH) {
          this.logger('warn', `Regex too long (${pattern.length} > ${MAX_REGEX_LENGTH})`);
          return false;
        }
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(value);
        } catch {
          this.logger('warn', `Invalid regex: ${pattern}`);
          return false;
        }
      }
    }

    return false;
  }

  /** Get a value from the evaluation context by dotted path */
  private getContextValue(context: EvalContext, field: string): unknown {
    const parts = field.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}
