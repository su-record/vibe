// Skill Benchmark - Phase 5: Aggregate eval results into benchmarks
// Tracks pass rate, time, tokens across iterations
//
// Produces benchmark reports for comparing:
// - with-skill vs baseline performance
// - Current iteration vs previous iterations
// - Per-eval and per-assertion breakdowns
import { randomUUID } from 'crypto';
import { SkillEvalRunner } from './SkillEvalRunner.js';
export class SkillBenchmark {
    db;
    evalRunner;
    constructor(storage) {
        this.db = storage.getDatabase();
        this.evalRunner = new SkillEvalRunner(storage);
        this.initializeTables();
    }
    initializeTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS skill_benchmarks (
        id TEXT PRIMARY KEY,
        skillName TEXT NOT NULL,
        iteration INTEGER NOT NULL,
        summary TEXT NOT NULL,
        evalBreakdowns TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sb_skill ON skill_benchmarks(skillName);
      CREATE INDEX IF NOT EXISTS idx_sb_iter ON skill_benchmarks(skillName, iteration);
    `);
    }
    /**
     * Aggregate latest eval runs into a benchmark
     */
    aggregate(skillName) {
        const latestRuns = this.evalRunner.getLatestRuns(skillName);
        const evalCases = this.evalRunner.getEvalCases(skillName);
        const iteration = this.getNextIteration(skillName);
        const withSkillRuns = [];
        const baselineRuns = [];
        const breakdowns = [];
        for (const evalCase of evalCases) {
            const runPair = latestRuns.get(evalCase.id);
            const ws = runPair?.withSkill ?? null;
            const bl = runPair?.baseline ?? null;
            if (ws)
                withSkillRuns.push(ws);
            if (bl)
                baselineRuns.push(bl);
            breakdowns.push({
                evalId: evalCase.id,
                prompt: evalCase.prompt,
                withSkillPassed: ws?.status === 'passed',
                baselinePassed: bl?.status === 'passed',
                withSkillDurationMs: ws?.durationMs ?? 0,
                baselineDurationMs: bl?.durationMs ?? 0,
                withSkillTokens: ws?.tokenCount ?? 0,
                baselineTokens: bl?.tokenCount ?? 0,
                assertionResults: this.mergeAssertionResults(ws, bl),
            });
        }
        const withSkillStats = this.computeVariantStats(withSkillRuns);
        const baselineStats = this.computeVariantStats(baselineRuns);
        const summary = {
            totalEvals: evalCases.length,
            withSkill: withSkillStats,
            baseline: baselineStats,
            delta: {
                passRateDelta: withSkillStats.passRate - baselineStats.passRate,
                durationDeltaMs: withSkillStats.meanDurationMs - baselineStats.meanDurationMs,
                tokenDelta: withSkillStats.meanTokens - baselineStats.meanTokens,
            },
        };
        const id = `bench-${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
        const now = new Date().toISOString();
        this.db.prepare(`
      INSERT INTO skill_benchmarks (id, skillName, iteration, summary, evalBreakdowns, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, skillName, iteration, JSON.stringify(summary), JSON.stringify(breakdowns), now);
        return { id, skillName, iteration, timestamp: now, summary, evalBreakdowns: breakdowns };
    }
    /**
     * Get benchmark history for a skill
     */
    getHistory(skillName) {
        const rows = this.db.prepare(`
      SELECT * FROM skill_benchmarks WHERE skillName = ? ORDER BY iteration ASC
    `).all(skillName);
        return rows.map(this.rowToBenchmark);
    }
    /**
     * Get the latest benchmark for a skill
     */
    getLatest(skillName) {
        const row = this.db.prepare(`
      SELECT * FROM skill_benchmarks WHERE skillName = ? ORDER BY iteration DESC LIMIT 1
    `).get(skillName);
        return row ? this.rowToBenchmark(row) : null;
    }
    /**
     * Compare two benchmark iterations
     */
    compare(skillName, iterA, iterB) {
        const a = this.getBenchmarkByIteration(skillName, iterA);
        const b = this.getBenchmarkByIteration(skillName, iterB);
        if (!a || !b) {
            return { iterationA: a, iterationB: b, improvement: null };
        }
        return {
            iterationA: a,
            iterationB: b,
            improvement: {
                passRateDelta: b.summary.withSkill.passRate - a.summary.withSkill.passRate,
                durationDeltaMs: b.summary.withSkill.meanDurationMs - a.summary.withSkill.meanDurationMs,
                tokenDelta: b.summary.withSkill.meanTokens - a.summary.withSkill.meanTokens,
            },
        };
    }
    /**
     * Format benchmark as markdown report
     */
    formatReport(benchmark) {
        const { summary } = benchmark;
        const lines = [
            `# Benchmark: ${benchmark.skillName} (Iteration ${benchmark.iteration})`,
            '',
            `**Date**: ${benchmark.timestamp}`,
            '',
            '## Summary',
            '',
            '| Metric | With Skill | Baseline | Delta |',
            '|--------|-----------|----------|-------|',
            `| Pass Rate | ${this.pct(summary.withSkill.passRate)} | ${this.pct(summary.baseline.passRate)} | ${this.signedPct(summary.delta.passRateDelta)} |`,
            `| Mean Duration | ${summary.withSkill.meanDurationMs.toFixed(0)}ms | ${summary.baseline.meanDurationMs.toFixed(0)}ms | ${summary.delta.durationDeltaMs > 0 ? '+' : ''}${summary.delta.durationDeltaMs.toFixed(0)}ms |`,
            `| Mean Tokens | ${summary.withSkill.meanTokens.toFixed(0)} | ${summary.baseline.meanTokens.toFixed(0)} | ${summary.delta.tokenDelta > 0 ? '+' : ''}${summary.delta.tokenDelta.toFixed(0)} |`,
            '',
            '## Per-Eval Breakdown',
            '',
        ];
        for (const bd of benchmark.evalBreakdowns) {
            const wsIcon = bd.withSkillPassed ? 'PASS' : 'FAIL';
            const blIcon = bd.baselinePassed ? 'PASS' : 'FAIL';
            lines.push(`### ${bd.evalId}`);
            lines.push(`- **Prompt**: ${bd.prompt.slice(0, 80)}${bd.prompt.length > 80 ? '...' : ''}`);
            lines.push(`- **With Skill**: ${wsIcon} (${bd.withSkillDurationMs}ms, ${bd.withSkillTokens} tokens)`);
            lines.push(`- **Baseline**: ${blIcon} (${bd.baselineDurationMs}ms, ${bd.baselineTokens} tokens)`);
            if (bd.assertionResults.length > 0) {
                lines.push('- **Assertions**:');
                for (const ar of bd.assertionResults) {
                    const wsA = ar.withSkillPassed ? 'PASS' : 'FAIL';
                    const blA = ar.baselinePassed ? 'PASS' : 'FAIL';
                    lines.push(`  - ${ar.description}: skill=${wsA}, baseline=${blA}`);
                }
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    getBenchmarkByIteration(skillName, iteration) {
        const row = this.db.prepare(`
      SELECT * FROM skill_benchmarks WHERE skillName = ? AND iteration = ?
    `).get(skillName, iteration);
        return row ? this.rowToBenchmark(row) : null;
    }
    getNextIteration(skillName) {
        const row = this.db.prepare(`
      SELECT MAX(iteration) as maxIter FROM skill_benchmarks WHERE skillName = ?
    `).get(skillName);
        return (row.maxIter ?? 0) + 1;
    }
    computeVariantStats(runs) {
        if (runs.length === 0) {
            return { passRate: 0, meanDurationMs: 0, stddevDurationMs: 0, meanTokens: 0, stddevTokens: 0, totalRuns: 0 };
        }
        const passed = runs.filter(r => r.status === 'passed').length;
        const durations = runs.map(r => r.durationMs);
        const tokens = runs.map(r => r.tokenCount);
        return {
            passRate: passed / runs.length,
            meanDurationMs: mean(durations),
            stddevDurationMs: stddev(durations),
            meanTokens: mean(tokens),
            stddevTokens: stddev(tokens),
            totalRuns: runs.length,
        };
    }
    mergeAssertionResults(ws, bl) {
        const wsGrades = ws?.grades ?? [];
        const blGrades = bl?.grades ?? [];
        // Use ws assertions as base, merge baseline grades
        const allDescriptions = new Set([
            ...wsGrades.map(g => g.description),
            ...blGrades.map(g => g.description),
        ]);
        return Array.from(allDescriptions).map(desc => ({
            description: desc,
            withSkillPassed: wsGrades.find(g => g.description === desc)?.passed ?? false,
            baselinePassed: blGrades.find(g => g.description === desc)?.passed ?? false,
        }));
    }
    pct(value) {
        return `${(value * 100).toFixed(1)}%`;
    }
    signedPct(value) {
        const sign = value > 0 ? '+' : '';
        return `${sign}${(value * 100).toFixed(1)}%`;
    }
    rowToBenchmark(row) {
        return {
            id: row.id,
            skillName: row.skillName,
            iteration: row.iteration,
            timestamp: row.createdAt,
            summary: JSON.parse(row.summary),
            evalBreakdowns: JSON.parse(row.evalBreakdowns),
        };
    }
}
// --- Utility functions ---
function mean(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}
function stddev(values) {
    if (values.length < 2)
        return 0;
    const avg = mean(values);
    const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
}
//# sourceMappingURL=SkillBenchmark.js.map