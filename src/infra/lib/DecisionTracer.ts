/**
 * DecisionTracer — AI decision audit trail
 *
 * All data is stored locally only (JSONL).
 * File: ~/.vibe/analytics/decisions.jsonl
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface DecisionRecord {
  /** Schema version */
  v: 1;
  /** ISO 8601 timestamp */
  ts: string;
  /** Decision category */
  category: DecisionCategory;
  /** What was decided */
  decision: string;
  /** Why this was chosen (rationale) */
  rationale: string;
  /** What alternatives were considered */
  alternatives: string[];
  /** Context that informed the decision */
  context: DecisionContext;
  /** Outcome (filled later via updateOutcome) */
  outcome?: DecisionOutcome;
  /** Unique decision ID */
  id: string;
}

export type DecisionCategory =
  | 'architecture'
  | 'implementation'
  | 'fix_strategy'
  | 'verification'
  | 'retry'
  | 'scope_change'
  | 'tool_selection';

export interface DecisionContext {
  /** Feature/SPEC being worked on */
  feature?: string;
  /** Current phase */
  phase?: string;
  /** Related file paths */
  files: string[];
  /** Automation level at time of decision */
  automationLevel?: number;
}

export interface DecisionOutcome {
  /** Whether the decision led to success */
  success: boolean;
  /** Impact description */
  impact: string;
  /** Timestamp of outcome recording */
  recordedAt: string;
}

export interface DecisionInput {
  category: DecisionCategory;
  decision: string;
  rationale: string;
  alternatives?: string[];
  context?: Partial<DecisionContext>;
}

export interface FeatureSummary {
  feature: string;
  totalDecisions: number;
  byCategory: Record<string, number>;
  successRate: number | null;
  decisions: DecisionRecord[];
}

function buildRecord(input: DecisionInput): DecisionRecord {
  return {
    v: 1,
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    category: input.category,
    decision: input.decision,
    rationale: input.rationale,
    alternatives: input.alternatives ?? [],
    context: {
      files: [],
      ...input.context,
    },
  };
}

function parseLines(content: string): DecisionRecord[] {
  return content
    .trim()
    .split('\n')
    .filter(line => line.trim().length > 0)
    .flatMap(line => {
      try {
        return [JSON.parse(line) as DecisionRecord];
      } catch {
        return [];
      }
    });
}

function computeSuccessRate(decisions: DecisionRecord[]): number | null {
  const withOutcome = decisions.filter(d => d.outcome !== undefined);
  if (withOutcome.length === 0) return null;
  const successes = withOutcome.filter(d => d.outcome!.success).length;
  return successes / withOutcome.length;
}

export class DecisionTracer {
  private readonly logPath: string;
  private readonly enabled: boolean;

  constructor(analyticsDir: string, enabled = true) {
    this.logPath = path.join(analyticsDir, 'decisions.jsonl');
    this.enabled = enabled;

    if (enabled) {
      fs.mkdirSync(analyticsDir, { recursive: true });
    }
  }

  /** Record a new decision */
  record(input: DecisionInput): DecisionRecord {
    const record = buildRecord(input);
    if (this.enabled) {
      try {
        fs.appendFileSync(this.logPath, JSON.stringify(record) + '\n');
      } catch {
        // Silent fail — tracing should never break the tool
      }
    }
    return record;
  }

  /** Update outcome for a previous decision */
  updateOutcome(
    decisionId: string,
    outcome: Omit<DecisionOutcome, 'recordedAt'>,
  ): boolean {
    if (!this.enabled) return false;

    const records = this.readAll();
    const index = records.findIndex(r => r.id === decisionId);
    if (index === -1) return false;

    records[index] = {
      ...records[index],
      outcome: { ...outcome, recordedAt: new Date().toISOString() },
    };

    try {
      const content = records.map(r => JSON.stringify(r)).join('\n') + '\n';
      fs.writeFileSync(this.logPath, content);
      return true;
    } catch {
      return false;
    }
  }

  /** Read all decisions */
  readAll(): DecisionRecord[] {
    if (!fs.existsSync(this.logPath)) return [];
    try {
      const content = fs.readFileSync(this.logPath, 'utf-8');
      return parseLines(content);
    } catch {
      return [];
    }
  }

  /** Query decisions by category */
  queryByCategory(category: DecisionCategory): DecisionRecord[] {
    return this.readAll().filter(r => r.category === category);
  }

  /** Query decisions by feature */
  queryByFeature(feature: string): DecisionRecord[] {
    return this.readAll().filter(r => r.context.feature === feature);
  }

  /** Get recent decisions (last N) */
  getRecent(count: number): DecisionRecord[] {
    const all = this.readAll();
    return all.slice(Math.max(0, all.length - count));
  }

  /** Summarize decisions for a feature */
  summarizeFeature(feature: string): FeatureSummary {
    const decisions = this.queryByFeature(feature);

    const byCategory: Record<string, number> = {};
    for (const d of decisions) {
      byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
    }

    return {
      feature,
      totalDecisions: decisions.length,
      byCategory,
      successRate: computeSuccessRate(decisions),
      decisions,
    };
  }

  /** Get log path */
  getLogPath(): string {
    return this.logPath;
  }
}
