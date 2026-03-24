// DeprecationDetector - Phase 5: Model evolution-driven skill deprecation detection
//
// Scans all skills with eval data and produces a deprecation report by:
// 1. Classifying each skill (capability_uplift vs encoded_preference)
// 2. Checking baseline trend from benchmark history
// 3. Determining deprecation severity
// 4. Producing a structured report with actionable recommendations

import { randomUUID } from 'crypto';
import { MemoryStorage } from '../memory/MemoryStorage.js';
import { SkillClassifier, ClassificationResult } from './SkillClassifier.js';
import { SkillBenchmark, BenchmarkResult } from './SkillBenchmark.js';
import { SkillEvalRunner } from './SkillEvalRunner.js';

export interface DeprecationCandidate {
  skillName: string;
  classification: ClassificationResult;
  /** Latest benchmark if available */
  latestBenchmark: BenchmarkResult | null;
  /** Reason for deprecation candidacy */
  reason: string;
  /** Severity: how urgent is deprecation */
  severity: 'immediate' | 'soon' | 'monitor';
  /** Suggested action */
  action: string;
}

export interface DeprecationReport {
  /** Report ID */
  id: string;
  /** Timestamp */
  timestamp: string;
  /** All skills analyzed */
  totalSkills: number;
  /** Skills with eval data */
  evaluatedSkills: number;
  /** Deprecation candidates found */
  candidates: DeprecationCandidate[];
  /** Skills that are safe (encoded preference) */
  safeSkills: string[];
  /** Skills with no eval data (unknown) */
  unevaluatedSkills: string[];
  /** Summary stats */
  summary: {
    immediate: number;
    soon: number;
    monitor: number;
    safe: number;
    unknown: number;
  };
}

interface SeverityResult {
  severity: DeprecationCandidate['severity'];
  reason: string;
  action: string;
}

const IMMEDIATE_BASELINE_THRESHOLD = 0.85;
const SOON_BASELINE_THRESHOLD = 0.70;

export class DeprecationDetector {
  private classifier: SkillClassifier;
  private benchmark: SkillBenchmark;
  private evalRunner: SkillEvalRunner;
  private db: ReturnType<MemoryStorage['getDatabase']>;

  constructor(storage: MemoryStorage) {
    this.classifier = new SkillClassifier(storage);
    this.benchmark = new SkillBenchmark(storage);
    this.evalRunner = new SkillEvalRunner(storage);
    this.db = storage.getDatabase();
  }

  /**
   * Scan all skills that have eval cases and produce deprecation report.
   */
  public scan(): DeprecationReport {
    const evaluatedSkillNames = this.getEvaluatedSkills();
    const candidates: DeprecationCandidate[] = [];
    const safeSkills: string[] = [];
    const unevaluatedSkills: string[] = [];

    for (const skillName of evaluatedSkillNames) {
      const candidate = this.checkSkill(skillName);
      if (candidate !== null) {
        candidates.push(candidate);
      } else {
        const classification = this.classifier.classify(skillName);
        if (classification.category === 'encoded_preference') {
          safeSkills.push(skillName);
        } else if (classification.category === 'unknown') {
          unevaluatedSkills.push(skillName);
        } else {
          safeSkills.push(skillName);
        }
      }
    }

    return {
      id: `depr-${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      totalSkills: evaluatedSkillNames.length,
      evaluatedSkills: evaluatedSkillNames.length,
      candidates,
      safeSkills,
      unevaluatedSkills,
      summary: {
        immediate: candidates.filter(c => c.severity === 'immediate').length,
        soon: candidates.filter(c => c.severity === 'soon').length,
        monitor: candidates.filter(c => c.severity === 'monitor').length,
        safe: safeSkills.length,
        unknown: unevaluatedSkills.length,
      },
    };
  }

  /**
   * Check a single skill for deprecation candidacy.
   * Returns null if the skill is not a deprecation candidate.
   */
  public checkSkill(skillName: string): DeprecationCandidate | null {
    const classification = this.classifier.classify(skillName);

    if (classification.category === 'encoded_preference') {
      return null;
    }

    const latestBenchmark = this.benchmark.getLatest(skillName);
    const { severity, reason, action } = this.determineSeverity(classification, latestBenchmark);

    if (classification.category === 'unknown' && severity === 'monitor') {
      return null;
    }

    return {
      skillName,
      classification,
      latestBenchmark,
      reason,
      severity,
      action,
    };
  }

  /**
   * Get all skill names that have eval cases in the DB.
   */
  public getEvaluatedSkills(): string[] {
    const rows = this.db.prepare(
      'SELECT DISTINCT skillName FROM skill_eval_cases ORDER BY skillName ASC'
    ).all() as Array<{ skillName: string }>;
    return rows.map(r => r.skillName);
  }

  /**
   * Format deprecation report as markdown.
   */
  public formatReport(report: DeprecationReport): string {
    const lines: string[] = [
      '# Skill Deprecation Report',
      '',
      `**Report ID**: ${report.id}`,
      `**Generated**: ${report.timestamp}`,
      `**Total Skills Analyzed**: ${report.totalSkills}`,
      '',
      '## Summary',
      '',
      '| Status | Count |',
      '|--------|-------|',
      `| 🔴 Immediate | ${report.summary.immediate} |`,
      `| 🟠 Soon | ${report.summary.soon} |`,
      `| 🟡 Monitor | ${report.summary.monitor} |`,
      `| 🟢 Safe | ${report.summary.safe} |`,
      `| ⚪ Unknown | ${report.summary.unknown} |`,
      '',
    ];

    if (report.candidates.length > 0) {
      lines.push('## Deprecation Candidates', '');
      for (const candidate of report.candidates) {
        const icon = candidate.severity === 'immediate' ? '🔴' :
          candidate.severity === 'soon' ? '🟠' : '🟡';
        lines.push(`### ${icon} ${candidate.skillName} (${candidate.severity})`);
        lines.push('');
        lines.push(`**Category**: ${candidate.classification.category}`);
        lines.push(`**Baseline Pass Rate**: ${pct(candidate.classification.baselinePassRate)}`);
        lines.push(`**With-Skill Pass Rate**: ${pct(candidate.classification.withSkillPassRate)}`);
        lines.push(`**Trend**: ${candidate.classification.trend}`);
        lines.push(`**Reason**: ${candidate.reason}`);
        lines.push(`**Action**: ${candidate.action}`);
        lines.push('');
      }
    }

    if (report.safeSkills.length > 0) {
      lines.push('## Safe Skills (Encoded Preferences)', '');
      for (const name of report.safeSkills) {
        lines.push(`- 🟢 ${name}`);
      }
      lines.push('');
    }

    if (report.unevaluatedSkills.length > 0) {
      lines.push('## Unknown Skills (Insufficient Data)', '');
      for (const name of report.unevaluatedSkills) {
        lines.push(`- ⚪ ${name}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Determine severity based on classification and benchmark data.
   */
  private determineSeverity(
    classification: ClassificationResult,
    benchmark: BenchmarkResult | null
  ): SeverityResult {
    const blRate = classification.baselinePassRate;
    const trend = classification.trend;

    if (blRate >= IMMEDIATE_BASELINE_THRESHOLD && trend === 'converging') {
      return {
        severity: 'immediate',
        reason: `Baseline pass rate is ${pct(blRate)} and converging — the model now handles this natively.`,
        action: 'Retire this skill. It is no longer providing meaningful uplift.',
      };
    }

    if (blRate >= IMMEDIATE_BASELINE_THRESHOLD) {
      return {
        severity: 'immediate',
        reason: `Baseline pass rate is ${pct(blRate)} — model handles this well without the skill.`,
        action: 'Schedule retirement. Verify with one more benchmark iteration.',
      };
    }

    if (blRate >= SOON_BASELINE_THRESHOLD || (classification.category === 'capability_uplift' && trend === 'converging')) {
      return {
        severity: 'soon',
        reason: buildSoonReason(blRate, classification.category, trend),
        action: 'Plan deprecation in next model update cycle. Continue monitoring.',
      };
    }

    if (classification.category === 'capability_uplift') {
      return {
        severity: 'monitor',
        reason: `Capability uplift skill with baseline at ${pct(blRate)} — not yet converging but worth watching.`,
        action: 'Re-evaluate after the next model upgrade.',
      };
    }

    const benchmarkNote = benchmark ? ` (iteration ${benchmark.iteration})` : '';
    return {
      severity: 'monitor',
      reason: `Insufficient signal to recommend deprecation${benchmarkNote}. Run more benchmarks.`,
      action: 'Gather more benchmark data before deciding.',
    };
  }
}

// --- Helpers ---

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function buildSoonReason(
  blRate: number,
  category: string,
  trend: string
): string {
  if (blRate >= SOON_BASELINE_THRESHOLD) {
    return `Baseline pass rate is ${pct(blRate)} — approaching obsolescence threshold.`;
  }
  if (category === 'capability_uplift' && trend === 'converging') {
    return 'Capability uplift skill showing converging trend — model is closing the gap.';
  }
  return `Capability uplift skill with ${pct(blRate)} baseline pass rate.`;
}
