import { MemoryStorage } from '../memory/MemoryStorage.js';
import { ClassificationResult } from './SkillClassifier.js';
import { BenchmarkResult } from './SkillBenchmark.js';
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
export declare class DeprecationDetector {
    private classifier;
    private benchmark;
    private evalRunner;
    private db;
    constructor(storage: MemoryStorage);
    /**
     * Scan all skills that have eval cases and produce deprecation report.
     */
    scan(): DeprecationReport;
    /**
     * Check a single skill for deprecation candidacy.
     * Returns null if the skill is not a deprecation candidate.
     */
    checkSkill(skillName: string): DeprecationCandidate | null;
    /**
     * Get all skill names that have eval cases in the DB.
     */
    getEvaluatedSkills(): string[];
    /**
     * Format deprecation report as markdown.
     */
    formatReport(report: DeprecationReport): string;
    /**
     * Determine severity based on classification and benchmark data.
     */
    private determineSeverity;
}
//# sourceMappingURL=DeprecationDetector.d.ts.map