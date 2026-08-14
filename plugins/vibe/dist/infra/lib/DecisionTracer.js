/**
 * DecisionTracer — AI decision audit trail
 *
 * All data is stored locally only (JSONL).
 * File: ~/.vibe/analytics/decisions.jsonl
 *
 * @deprecated Not wired into the vibe runtime (no hook/skill/CLI consumer).
 * In-memory instance state does not survive vibe's per-event process model.
 * Retained for API compatibility; may be removed in a future major.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
function buildRecord(input) {
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
function parseLines(content) {
    return content
        .trim()
        .split('\n')
        .filter(line => line.trim().length > 0)
        .flatMap(line => {
        try {
            return [JSON.parse(line)];
        }
        catch {
            return [];
        }
    });
}
function computeSuccessRate(decisions) {
    const withOutcome = decisions.filter(d => d.outcome !== undefined);
    if (withOutcome.length === 0)
        return null;
    const successes = withOutcome.filter(d => d.outcome.success).length;
    return successes / withOutcome.length;
}
export class DecisionTracer {
    logPath;
    enabled;
    constructor(analyticsDir, enabled = true) {
        this.logPath = path.join(analyticsDir, 'decisions.jsonl');
        this.enabled = enabled;
        if (enabled) {
            fs.mkdirSync(analyticsDir, { recursive: true });
        }
    }
    /** Record a new decision */
    record(input) {
        const record = buildRecord(input);
        if (this.enabled) {
            try {
                fs.appendFileSync(this.logPath, JSON.stringify(record) + '\n');
            }
            catch {
                // Silent fail — tracing should never break the tool
            }
        }
        return record;
    }
    /** Update outcome for a previous decision */
    updateOutcome(decisionId, outcome) {
        if (!this.enabled)
            return false;
        const records = this.readAll();
        const index = records.findIndex(r => r.id === decisionId);
        if (index === -1)
            return false;
        records[index] = {
            ...records[index],
            outcome: { ...outcome, recordedAt: new Date().toISOString() },
        };
        try {
            const content = records.map(r => JSON.stringify(r)).join('\n') + '\n';
            fs.writeFileSync(this.logPath, content);
            return true;
        }
        catch {
            return false;
        }
    }
    /** Read all decisions */
    readAll() {
        if (!fs.existsSync(this.logPath))
            return [];
        try {
            const content = fs.readFileSync(this.logPath, 'utf-8');
            return parseLines(content);
        }
        catch {
            return [];
        }
    }
    /** Query decisions by category */
    queryByCategory(category) {
        return this.readAll().filter(r => r.category === category);
    }
    /** Query decisions by feature */
    queryByFeature(feature) {
        return this.readAll().filter(r => r.context.feature === feature);
    }
    /** Get recent decisions (last N) */
    getRecent(count) {
        const all = this.readAll();
        return all.slice(Math.max(0, all.length - count));
    }
    /** Summarize decisions for a feature */
    summarizeFeature(feature) {
        const decisions = this.queryByFeature(feature);
        const byCategory = {};
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
    getLogPath() {
        return this.logPath;
    }
}
//# sourceMappingURL=DecisionTracer.js.map