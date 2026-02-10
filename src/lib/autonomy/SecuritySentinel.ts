import { resolve, relative } from 'path';
import { realpathSync } from 'fs';
import type Database from 'better-sqlite3';
import type { AgentActionEvent, RiskLevel } from './schemas.js';
import type { EventBus } from './EventBus.js';
import type { AuditStore } from './AuditStore.js';
import { RiskClassifier } from './RiskClassifier.js';
import type { RiskAssessment, CustomRiskRule, ClassificationContext } from './RiskClassifier.js';
import { PolicyEngine } from './PolicyEngine.js';
import type { PolicyDecision } from './PolicyEngine.js';

const SENTINEL_PATH_PREFIX = 'src/lib/autonomy/';

const SENTINEL_FILES: ReadonlyArray<string> = [
  'src/lib/autonomy/RiskClassifier.ts',
  'src/lib/autonomy/PolicyEngine.ts',
  'src/lib/autonomy/SecuritySentinel.ts',
  'src/lib/autonomy/EventBus.ts',
  'src/lib/autonomy/AuditStore.ts',
  'src/lib/autonomy/EventOutbox.ts',
  'src/lib/autonomy/schemas.ts',
  'src/lib/autonomy/index.ts',
];

const RECENT_DELETE_WINDOW_MS = 60_000;

export interface InterceptResult {
  allowed: boolean;
  riskLevel: RiskLevel;
  policyDecision: PolicyDecision;
  auditId: string;
}

interface StorageProvider {
  getDatabase(): Database.Database;
}

export interface SentinelDeps {
  storage: StorageProvider;
  eventBus: EventBus;
  auditStore: AuditStore;
  projectRoot?: string;
  customRules?: CustomRiskRule[];
}

export class SecuritySentinel {
  private static instance: SecuritySentinel | null = null;

  private readonly classifier: RiskClassifier;
  private readonly policyEngine: PolicyEngine;
  private readonly eventBus: EventBus;
  private readonly auditStore: AuditStore;
  private readonly db: Database.Database;
  private readonly projectRoot: string;
  private readonly recentDeleteStmt: Database.Statement;

  private constructor(deps: SentinelDeps) {
    this.classifier = new RiskClassifier(deps.customRules);
    this.policyEngine = new PolicyEngine(deps.storage);
    this.eventBus = deps.eventBus;
    this.auditStore = deps.auditStore;
    this.db = deps.storage.getDatabase();
    this.projectRoot = deps.projectRoot ?? process.cwd();
    this.recentDeleteStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM audit_events
       WHERE agentId = ? AND actionType = 'file_delete' AND createdAt >= ?`,
    );
  }

  static getInstance(deps: SentinelDeps): SecuritySentinel {
    if (!SecuritySentinel.instance) {
      SecuritySentinel.instance = new SecuritySentinel(deps);
    }
    return SecuritySentinel.instance;
  }

  static resetInstance(): void {
    SecuritySentinel.instance = null;
  }

  intercept(action: AgentActionEvent): InterceptResult {
    const normalizedAction = this.normalizeAction(action);

    // Block paths outside project root
    if (normalizedAction.target.startsWith('..')) {
      const outsideRisk: RiskAssessment = {
        riskLevel: 'HIGH',
        score: 100,
        factors: ['Path resolves outside project root'],
        reasoning: 'Path traversal outside project root is blocked',
        blocked: true,
      };
      const decision = this.blockedDecision(outsideRisk);
      this.emitPolicyCheck(normalizedAction, outsideRisk, decision);
      const auditId = this.recordAudit(normalizedAction, outsideRisk, decision);
      return { allowed: false, riskLevel: 'HIGH', policyDecision: decision, auditId };
    }

    const context = this.buildContext(normalizedAction);
    const risk = this.classifier.classify(normalizedAction, context);
    const policyDecision = risk.blocked
      ? this.blockedDecision(risk)
      : this.policyEngine.evaluate(normalizedAction, risk);

    this.emitPolicyCheck(normalizedAction, risk, policyDecision);
    const auditId = this.recordAudit(normalizedAction, risk, policyDecision);

    return {
      allowed: policyDecision.allowed,
      riskLevel: risk.riskLevel,
      policyDecision,
      auditId,
    };
  }

  isImmutable(): boolean {
    return true;
  }

  getSentinelFiles(): ReadonlyArray<string> {
    return SENTINEL_FILES;
  }

  getClassifier(): RiskClassifier {
    return this.classifier;
  }

  getPolicyEngine(): PolicyEngine {
    return this.policyEngine;
  }

  private normalizeAction(action: AgentActionEvent): AgentActionEvent {
    const normalizedTarget = this.normalizePath(action.target);
    return { ...action, target: normalizedTarget };
  }

  private normalizePath(target: string): string {
    const resolved = resolve(this.projectRoot, target);
    const rel = relative(this.projectRoot, resolved).replace(/\\/g, '/');
    if (rel.startsWith('..')) return rel;

    try {
      const real = realpathSync(resolved);
      const realRel = relative(this.projectRoot, real).replace(/\\/g, '/');
      return realRel.startsWith('..') ? realRel : realRel;
    } catch {
      return rel;
    }
  }

  private buildContext(action: AgentActionEvent): ClassificationContext | undefined {
    if (action.actionType !== 'file_delete') return undefined;
    const cutoff = new Date(Date.now() - RECENT_DELETE_WINDOW_MS).toISOString();
    const row = this.recentDeleteStmt.get(action.agentId, cutoff) as { count: number };
    return { recentDeleteCount: row.count };
  }

  private blockedDecision(risk: RiskAssessment): PolicyDecision {
    return {
      allowed: false,
      reason: `Sentinel files are protected: ${risk.reasoning}`,
      requiredAction: 'block',
      matchedPolicies: ['sentinel-immutability'],
    };
  }

  private emitPolicyCheck(
    action: AgentActionEvent,
    risk: RiskAssessment,
    decision: PolicyDecision,
  ): void {
    try {
      this.eventBus.emit('policy_check', {
        actionEvent: {
          agentId: action.agentId,
          actionType: action.actionType,
          target: action.target,
          params: action.params,
          riskLevel: risk.riskLevel,
        },
        policies: decision.matchedPolicies,
        result: decision.allowed ? 'allowed' : (decision.requiredAction === 'confirm' ? 'needs_confirmation' : 'blocked'),
        duration: 0,
      });
    } catch {
      // Policy check event emission failure should not break intercept
    }
  }

  private recordAudit(
    action: AgentActionEvent,
    risk: RiskAssessment,
    decision: PolicyDecision,
  ): string {
    const outcome = decision.allowed ? 'allowed' : 'blocked';
    return this.auditStore.record({
      correlationId: action.correlationId ?? `sentinel-${Date.now()}`,
      eventType: 'policy_check',
      agentId: action.agentId,
      actionType: action.actionType,
      riskLevel: risk.riskLevel,
      payload: {
        target: action.target,
        riskScore: risk.score,
        factors: risk.factors,
        matchedPolicies: decision.matchedPolicies,
        reason: decision.reason,
      },
      outcome,
    });
  }
}

export function isSentinelProtectedPath(target: string): boolean {
  const normalized = target.replace(/\\/g, '/').replace(/^\.\//, '');
  return normalized.startsWith(SENTINEL_PATH_PREFIX);
}
