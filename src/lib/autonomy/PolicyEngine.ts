import type Database from 'better-sqlite3';
import { z } from 'zod';
import { uuidv7 } from 'uuidv7';
import type { AgentActionEvent, RiskLevel } from './schemas.js';
import type { RiskAssessment } from './RiskClassifier.js';

const PolicyRuleFieldEnum = z.enum(['actionType', 'target', 'riskLevel', 'agentId', 'params']);
const PolicyRuleOperatorEnum = z.enum(['eq', 'neq', 'contains', 'matches', 'in', 'gt', 'lt']);

const PolicyRuleSchema = z.object({
  field: PolicyRuleFieldEnum,
  operator: PolicyRuleOperatorEnum,
  value: z.union([z.string(), z.array(z.string()), z.number()]),
});

export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

const PolicyActionEnum = z.enum(['block', 'require_confirmation', 'allow']);
export type PolicyAction = z.infer<typeof PolicyActionEnum>;

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  requiredAction?: 'confirm' | 'block';
  matchedPolicies: string[];
}

export interface PolicyRow {
  id: string;
  name: string;
  description: string | null;
  rules: string;
  action: string;
  priority: number;
  enabled: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface StorageProvider {
  getDatabase(): Database.Database;
}

const DEFAULT_POLICIES: Array<{
  name: string;
  description: string;
  rules: PolicyRule[];
  action: PolicyAction;
  priority: number;
}> = [
  {
    name: 'deny-force-push',
    description: 'Block git force push operations',
    rules: [
      { field: 'actionType', operator: 'eq', value: 'git_push' },
      { field: 'params', operator: 'contains', value: 'force' },
    ],
    action: 'block',
    priority: 100,
  },
  {
    name: 'deny-sentinel-modify',
    description: 'Block modification of sentinel code and configuration',
    rules: [
      { field: 'target', operator: 'matches', value: '^src[\\\\/]lib[\\\\/]autonomy[\\\\/]' },
    ],
    action: 'block',
    priority: 100,
  },
  {
    name: 'deny-mass-delete',
    description: 'Block mass file deletion (5+ files)',
    rules: [
      { field: 'actionType', operator: 'eq', value: 'file_delete' },
      { field: 'riskLevel', operator: 'eq', value: 'HIGH' },
    ],
    action: 'block',
    priority: 90,
  },
  {
    name: 'require-approval-high-risk',
    description: 'Require owner approval for high-risk actions',
    rules: [{ field: 'riskLevel', operator: 'eq', value: 'HIGH' }],
    action: 'require_confirmation',
    priority: 50,
  },
  {
    name: 'audit-all-actions',
    description: 'Log all actions to audit store',
    rules: [],
    action: 'allow',
    priority: 0,
  },
];

export class PolicyEngine {
  private readonly db: Database.Database;
  private readonly allPoliciesStmt: Database.Statement;

  constructor(storage: StorageProvider) {
    this.db = storage.getDatabase();
    this.initTables();
    this.seedDefaultPolicies();
    this.allPoliciesStmt = this.db.prepare(
      `SELECT * FROM policies WHERE enabled = 1 ORDER BY priority DESC, createdAt ASC`,
    );
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS policies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        rules TEXT NOT NULL,
        action TEXT NOT NULL DEFAULT 'block'
          CHECK(action IN ('block', 'require_confirmation', 'allow')),
        priority INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 1,
        version INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
  }

  private seedDefaultPolicies(): void {
    const insertOrIgnore = this.db.prepare(`
      INSERT OR IGNORE INTO policies (id, name, description, rules, action, priority, enabled, version, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
    `);
    const now = new Date().toISOString();
    const txn = this.db.transaction(() => {
      for (const policy of DEFAULT_POLICIES) {
        insertOrIgnore.run(
          uuidv7(),
          policy.name,
          policy.description,
          JSON.stringify(policy.rules),
          policy.action,
          policy.priority,
          now,
          now,
        );
      }
    });
    txn();
  }

  evaluate(
    action: AgentActionEvent,
    riskAssessment: RiskAssessment,
  ): PolicyDecision {
    const policies = this.allPoliciesStmt.all() as PolicyRow[];
    const matchedPolicies: string[] = [];
    let strictestAction: PolicyAction = 'allow';

    for (const policy of policies) {
      const rules = this.parseRules(policy.rules);
      if (rules === null) continue;
      if (this.matchesAllRules(rules, action, riskAssessment.riskLevel)) {
        matchedPolicies.push(policy.name);
        strictestAction = this.stricterAction(strictestAction, policy.action as PolicyAction);
      }
    }

    return this.buildDecision(strictestAction, matchedPolicies);
  }

  addPolicy(policy: {
    name: string;
    description?: string;
    rules: PolicyRule[];
    action: PolicyAction;
    priority?: number;
  }): string {
    const id = uuidv7();
    const now = new Date().toISOString();
    for (const rule of policy.rules) {
      PolicyRuleSchema.parse(rule);
    }
    this.db
      .prepare(
        `INSERT INTO policies (id, name, description, rules, action, priority, enabled, version, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
      )
      .run(
        id,
        policy.name,
        policy.description ?? null,
        JSON.stringify(policy.rules),
        policy.action,
        policy.priority ?? 0,
        now,
        now,
      );
    return id;
  }

  getPolicyCount(): number {
    return (
      this.db.prepare('SELECT COUNT(*) as count FROM policies WHERE enabled = 1').get() as {
        count: number;
      }
    ).count;
  }

  private parseRules(rulesJson: string): PolicyRule[] | null {
    try {
      const parsed = JSON.parse(rulesJson) as unknown;
      if (!Array.isArray(parsed)) return null;
      return parsed as PolicyRule[];
    } catch {
      return null;
    }
  }

  private matchesAllRules(
    rules: PolicyRule[],
    action: AgentActionEvent,
    riskLevel: RiskLevel,
  ): boolean {
    if (rules.length === 0) return true;
    return rules.every((rule) => this.evaluateRule(rule, action, riskLevel));
  }

  private evaluateRule(
    rule: PolicyRule,
    action: AgentActionEvent,
    riskLevel: RiskLevel,
  ): boolean {
    const fieldValue = this.getFieldValue(rule.field, action, riskLevel);
    return this.applyOperator(rule.operator, fieldValue, rule.value);
  }

  private getFieldValue(
    field: string,
    action: AgentActionEvent,
    riskLevel: RiskLevel,
  ): string | number | undefined {
    switch (field) {
      case 'actionType': return action.actionType;
      case 'target': return action.target;
      case 'riskLevel': return riskLevel;
      case 'agentId': return action.agentId;
      case 'params': return JSON.stringify(action.params ?? {});
      default: return undefined;
    }
  }

  private applyOperator(
    operator: string,
    fieldValue: string | number | undefined,
    ruleValue: string | string[] | number,
  ): boolean {
    if (fieldValue === undefined) return false;
    const strField = String(fieldValue);

    switch (operator) {
      case 'eq': return strField === String(ruleValue);
      case 'neq': return strField !== String(ruleValue);
      case 'contains': return strField.includes(String(ruleValue));
      case 'matches':
        try { return new RegExp(String(ruleValue)).test(strField); } catch { return false; }
      case 'in': return Array.isArray(ruleValue) && ruleValue.includes(strField);
      case 'gt': return Number(fieldValue) > Number(ruleValue);
      case 'lt': return Number(fieldValue) < Number(ruleValue);
      default: return false;
    }
  }

  private stricterAction(current: PolicyAction, candidate: PolicyAction): PolicyAction {
    const priority: Record<PolicyAction, number> = {
      block: 2,
      require_confirmation: 1,
      allow: 0,
    };
    return priority[candidate] > priority[current] ? candidate : current;
  }

  private buildDecision(action: PolicyAction, matchedPolicies: string[]): PolicyDecision {
    if (action === 'block') {
      return {
        allowed: false,
        reason: `Blocked by policies: ${matchedPolicies.join(', ')}`,
        requiredAction: 'block',
        matchedPolicies,
      };
    }
    if (action === 'require_confirmation') {
      return {
        allowed: false,
        reason: `Owner confirmation required by policies: ${matchedPolicies.join(', ')}`,
        requiredAction: 'confirm',
        matchedPolicies,
      };
    }
    return {
      allowed: true,
      reason: matchedPolicies.length > 0 ? `Allowed by policies: ${matchedPolicies.join(', ')}` : 'No matching policies',
      matchedPolicies,
    };
  }
}
