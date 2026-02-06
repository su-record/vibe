/**
 * Policy Engine Type Definitions
 * Phase 3: Policy Engine
 */

// ============================================================================
// Risk & Decision
// ============================================================================

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type PolicyDecision = 'approve' | 'warn' | 'reject' | 'ignore';
export type PolicyEffect = 'approve' | 'warn' | 'reject' | 'ignore';
export type ConditionOperator = 'equals' | 'contains' | 'regex' | 'in' | 'gt' | 'lt' | 'not';

// ============================================================================
// Policy Definition
// ============================================================================

export interface PolicyRule {
  id: string;
  description: string;
  condition: PolicyCondition;
  effect: PolicyEffect;
  message: string;
  severity?: RiskLevel;
}

export interface PolicyCondition {
  [field: string]: unknown;
  $or?: PolicyCondition[];
  $not?: PolicyCondition;
}

export interface Policy {
  name: string;
  version: string;
  type: 'safety' | 'configuration';
  enabled: boolean;
  rules: PolicyRule[];
}

export interface PolicyFile extends Policy {
  filePath?: string;
  source: 'builtin' | 'user' | 'project';
}

// ============================================================================
// Evaluation Result
// ============================================================================

export interface EvaluationReason {
  rule: string;
  ruleId: string;
  message: string;
  severity: RiskLevel;
  effect: PolicyEffect;
}

export interface EvaluationResult {
  decision: PolicyDecision;
  riskLevel: RiskLevel;
  reasons: EvaluationReason[];
  requiresApproval: boolean;
  suggestions: string[];
}

// ============================================================================
// Evidence
// ============================================================================

export type EvidenceEventType =
  | 'job_created'
  | 'state_transition'
  | 'policy_evaluation'
  | 'user_approval'
  | 'execution_result'
  | 'policy_change';

export interface EvidenceRecord {
  id?: number;
  jobId: string;
  eventType: EvidenceEventType;
  decision: string;
  payload: Record<string, unknown>;
  actor: string;
  source: string;
  createdAt: string;
}

// ============================================================================
// Action Plan Context (for evaluation)
// ============================================================================

export interface EvalContext {
  actions: Array<{
    type: string;
    target: string;
    command?: string;
    [key: string]: unknown;
  }>;
  projectPath: string;
  riskLevel: RiskLevel;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Constants
// ============================================================================

export const RISK_ORDER: Record<RiskLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}
