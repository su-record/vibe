// Skill Classifier - Phase 5: Capability Uplift vs Encoded Preference
//
// Two types of skills (from Anthropic's taxonomy):
//
// 1. Capability Uplift: Compensates for what the model can't do well.
//    - Becomes obsolete as models improve
//    - Eval: if baseline (no skill) starts passing, the skill has served its purpose
//
// 2. Encoded Preference: Encodes team-specific workflow, style, or process.
//    - Durable regardless of model improvements
//    - Eval: baseline will never pass because the model can't know your preferences
import { SkillBenchmark } from './SkillBenchmark.js';
/**
 * Thresholds for classification
 */
const BASELINE_HIGH_THRESHOLD = 0.7;
const BASELINE_LOW_THRESHOLD = 0.3;
const CONVERGENCE_THRESHOLD = 0.15;
const MIN_BENCHMARKS_FOR_TREND = 2;
export class SkillClassifier {
    benchmark;
    constructor(storage) {
        this.benchmark = new SkillBenchmark(storage);
    }
    /**
     * Classify a skill based on benchmark history
     */
    classify(skillName) {
        const history = this.benchmark.getHistory(skillName);
        if (history.length === 0) {
            return {
                skillName,
                category: 'unknown',
                confidence: 0,
                reasoning: 'No benchmark data available. Run evals first.',
                baselinePassRate: 0,
                withSkillPassRate: 0,
                trend: 'insufficient_data',
                recommendation: 'Create eval cases and run benchmarks to classify this skill.',
            };
        }
        const latest = history[history.length - 1];
        const { withSkill, baseline } = latest.summary;
        const trend = this.computeTrend(history);
        return this.determineCategory(skillName, withSkill.passRate, baseline.passRate, trend, history.length);
    }
    /**
     * Classify based on explicit pass rates (no DB lookup)
     */
    classifyFromRates(skillName, withSkillPassRate, baselinePassRate, trend = 'insufficient_data') {
        return this.determineCategory(skillName, withSkillPassRate, baselinePassRate, trend, 1);
    }
    /**
     * Check if a skill is becoming obsolete (capability uplift that model now handles)
     */
    isBecomingObsolete(skillName) {
        const result = this.classify(skillName);
        if (result.category === 'capability_uplift' && result.trend === 'converging') {
            return {
                obsolete: true,
                reason: `Baseline pass rate (${this.pct(result.baselinePassRate)}) is converging with skill pass rate (${this.pct(result.withSkillPassRate)}). The model may now handle this without the skill.`,
            };
        }
        if (result.baselinePassRate >= BASELINE_HIGH_THRESHOLD) {
            return {
                obsolete: true,
                reason: `Baseline pass rate is ${this.pct(result.baselinePassRate)} — the model handles this well without the skill.`,
            };
        }
        return { obsolete: false, reason: 'Skill still provides significant value.' };
    }
    determineCategory(skillName, wsRate, blRate, trend, benchmarkCount) {
        const gap = wsRate - blRate;
        // Case 1: Baseline already performs well → capability uplift (possibly obsolete)
        if (blRate >= BASELINE_HIGH_THRESHOLD) {
            return {
                skillName,
                category: 'capability_uplift',
                confidence: Math.min(0.9, 0.5 + blRate * 0.4),
                reasoning: `Baseline pass rate is high (${this.pct(blRate)}), indicating the model can handle this well without the skill. This is a capability uplift skill that may be nearing obsolescence.`,
                baselinePassRate: blRate,
                withSkillPassRate: wsRate,
                trend,
                recommendation: gap < CONVERGENCE_THRESHOLD
                    ? 'Consider retiring this skill — the model handles this natively now.'
                    : 'Monitor baseline trend. The skill still adds some value.',
            };
        }
        // Case 2: Baseline performs poorly and skill helps a lot → likely encoded preference
        if (blRate <= BASELINE_LOW_THRESHOLD && gap > CONVERGENCE_THRESHOLD) {
            const isEncoded = trend === 'stable' || trend === 'diverging' || benchmarkCount < MIN_BENCHMARKS_FOR_TREND;
            return {
                skillName,
                category: isEncoded ? 'encoded_preference' : 'capability_uplift',
                confidence: isEncoded ? Math.min(0.85, 0.4 + gap * 0.5) : 0.5,
                reasoning: isEncoded
                    ? `Low baseline (${this.pct(blRate)}) with stable gap suggests team-specific preferences the model cannot infer.`
                    : `Low baseline (${this.pct(blRate)}) but converging trend suggests model capability gap that is closing.`,
                baselinePassRate: blRate,
                withSkillPassRate: wsRate,
                trend,
                recommendation: isEncoded
                    ? 'This skill encodes team preferences. Keep and maintain it.'
                    : 'Capability uplift skill. Monitor baseline improvements across model updates.',
            };
        }
        // Case 3: Middle ground — need more data or trend analysis
        if (trend === 'converging') {
            return {
                skillName,
                category: 'capability_uplift',
                confidence: 0.6,
                reasoning: `Baseline trend is converging toward skill performance, suggesting a capability gap that is closing.`,
                baselinePassRate: blRate,
                withSkillPassRate: wsRate,
                trend,
                recommendation: 'Likely capability uplift. Re-evaluate after model updates.',
            };
        }
        if (trend === 'stable' || trend === 'diverging') {
            return {
                skillName,
                category: 'encoded_preference',
                confidence: 0.55,
                reasoning: `Baseline-to-skill gap is stable/diverging, suggesting persistent team-specific knowledge.`,
                baselinePassRate: blRate,
                withSkillPassRate: wsRate,
                trend,
                recommendation: 'Likely encoded preference. Maintain and refine.',
            };
        }
        return {
            skillName,
            category: 'unknown',
            confidence: 0.3,
            reasoning: `Not enough data to classify confidently. Baseline: ${this.pct(blRate)}, With-skill: ${this.pct(wsRate)}.`,
            baselinePassRate: blRate,
            withSkillPassRate: wsRate,
            trend,
            recommendation: 'Run more benchmark iterations to gather trend data.',
        };
    }
    computeTrend(history) {
        if (history.length < MIN_BENCHMARKS_FOR_TREND) {
            return 'insufficient_data';
        }
        // Compare gap between first and last benchmarks
        const first = history[0];
        const last = history[history.length - 1];
        const firstGap = first.summary.withSkill.passRate - first.summary.baseline.passRate;
        const lastGap = last.summary.withSkill.passRate - last.summary.baseline.passRate;
        const gapChange = lastGap - firstGap;
        if (Math.abs(gapChange) < CONVERGENCE_THRESHOLD / 2) {
            return 'stable';
        }
        // Gap is shrinking → baseline is catching up → converging
        if (gapChange < 0) {
            return 'converging';
        }
        // Gap is growing → skill is pulling ahead → diverging
        return 'diverging';
    }
    pct(value) {
        return `${(value * 100).toFixed(1)}%`;
    }
}
//# sourceMappingURL=SkillClassifier.js.map