// ParityTester — Model version parity testing for skill obsolescence detection
//
// 모델 업그레이드 시:
// 1. 기존 eval 케이스로 새 모델의 baseline(스킬 없이) 성능 측정
// 2. 이전 모델 baseline과 비교
// 3. 새 모델 baseline이 기존 with-skill 수준에 근접하면 → deprecation 후보
import { randomUUID } from 'crypto';
export const PARITY_THRESHOLDS = {
    /** New baseline >= this fraction of with-skill → obsolete candidate */
    OBSOLESCENCE_RATIO: 0.85,
    /** Minimum improvement in baseline to consider significant */
    MIN_IMPROVEMENT: 0.1,
    /** Minimum eval cases for reliable parity test */
    MIN_EVAL_CASES: 3,
};
export class ParityTester {
    db;
    constructor(storage) {
        this.db = storage.getDatabase();
        this.initializeTables();
    }
    initializeTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS model_versions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        registeredAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS model_baseline_results (
        id TEXT PRIMARY KEY,
        skillName TEXT NOT NULL,
        modelId TEXT NOT NULL,
        evalId TEXT NOT NULL,
        prompt TEXT NOT NULL DEFAULT '',
        passed INTEGER NOT NULL DEFAULT 0,
        output TEXT NOT NULL DEFAULT '',
        durationMs INTEGER NOT NULL DEFAULT 0,
        tokenCount INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_mbr_skill_model ON model_baseline_results(skillName, modelId);
      CREATE INDEX IF NOT EXISTS idx_mbr_eval ON model_baseline_results(evalId);

      CREATE TABLE IF NOT EXISTS parity_tests (
        id TEXT PRIMARY KEY,
        skillName TEXT NOT NULL,
        oldModel TEXT NOT NULL,
        newModel TEXT NOT NULL,
        oldBaselinePassRate REAL NOT NULL,
        newBaselinePassRate REAL NOT NULL,
        withSkillPassRate REAL NOT NULL,
        parityScore REAL NOT NULL,
        obsoleteCandidate INTEGER NOT NULL DEFAULT 0,
        evalComparisons TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_pt_skill ON parity_tests(skillName);
    `);
    }
    /** Register a model version */
    registerModel(id, name) {
        const now = new Date().toISOString();
        this.db.prepare(`
      INSERT OR REPLACE INTO model_versions (id, name, registeredAt)
      VALUES (?, ?, ?)
    `).run(id, name, now);
        return { id, name, registeredAt: now };
    }
    /** Get all registered models */
    getModels() {
        const rows = this.db.prepare(`
      SELECT * FROM model_versions ORDER BY registeredAt ASC
    `).all();
        return rows.map(r => ({ id: r.id, name: r.name, registeredAt: r.registeredAt }));
    }
    /** Record baseline eval results for a specific model */
    recordModelBaseline(skillName, modelId, evalResults) {
        const now = new Date().toISOString();
        const insertStmt = this.db.prepare(`
      INSERT INTO model_baseline_results (id, skillName, modelId, evalId, prompt, passed, output, durationMs, tokenCount, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const insertMany = this.db.transaction(() => {
            for (const r of evalResults) {
                const id = `mbr-${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
                insertStmt.run(id, skillName, modelId, r.evalId, r.prompt ?? '', r.passed ? 1 : 0, r.output, r.durationMs, r.tokenCount, now);
            }
        });
        insertMany();
    }
    /**
     * Run a parity test by reading existing baseline data from model_baseline_results.
     * with-skill reference data is also read from model_baseline_results with variant 'with_skill'.
     */
    runParityTest(skillName, oldModel, newModel) {
        const oldRows = this.getBaselineRows(skillName, oldModel);
        const newRows = this.getBaselineRows(skillName, newModel);
        const withSkillRows = this.getBaselineRows(skillName, 'with_skill');
        const comparisons = this.buildComparisons(oldRows, newRows, withSkillRows);
        const oldBaselinePassRate = computePassRate(oldRows);
        const newBaselinePassRate = computePassRate(newRows);
        const withSkillPassRate = computePassRate(withSkillRows);
        const parityScore = withSkillPassRate > 0
            ? Math.min(1.0, newBaselinePassRate / withSkillPassRate)
            : (newBaselinePassRate > 0 ? 1.0 : 0.0);
        const obsoleteCandidate = parityScore >= PARITY_THRESHOLDS.OBSOLESCENCE_RATIO;
        const id = `parity-${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
        const now = new Date().toISOString();
        this.db.prepare(`
      INSERT INTO parity_tests (id, skillName, oldModel, newModel, oldBaselinePassRate, newBaselinePassRate, withSkillPassRate, parityScore, obsoleteCandidate, evalComparisons, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, skillName, oldModel, newModel, oldBaselinePassRate, newBaselinePassRate, withSkillPassRate, parityScore, obsoleteCandidate ? 1 : 0, JSON.stringify(comparisons), now);
        return {
            id,
            skillName,
            oldModel,
            newModel,
            oldBaselinePassRate,
            newBaselinePassRate,
            withSkillPassRate,
            parityScore,
            obsoleteCandidate,
            evalComparisons: comparisons,
            timestamp: now,
        };
    }
    /** Get parity test history for a skill */
    getHistory(skillName) {
        const rows = this.db.prepare(`
      SELECT * FROM parity_tests WHERE skillName = ? ORDER BY createdAt ASC
    `).all(skillName);
        return rows.map(rowToParityResult);
    }
    /** Get latest parity test */
    getLatest(skillName) {
        const row = this.db.prepare(`
      SELECT * FROM parity_tests WHERE skillName = ? ORDER BY createdAt DESC LIMIT 1
    `).get(skillName);
        return row ? rowToParityResult(row) : null;
    }
    /** Format parity test as markdown report */
    formatReport(result) {
        const lines = [
            `# Parity Report: ${result.skillName}`,
            '',
            `**Timestamp**: ${result.timestamp}`,
            `**Old Model**: ${result.oldModel}`,
            `**New Model**: ${result.newModel}`,
            '',
            '## Summary',
            '',
            '| Metric | Value |',
            '|--------|-------|',
            `| Old Baseline Pass Rate | ${pct(result.oldBaselinePassRate)} |`,
            `| New Baseline Pass Rate | ${pct(result.newBaselinePassRate)} |`,
            `| With-Skill Pass Rate | ${pct(result.withSkillPassRate)} |`,
            `| Parity Score | ${result.parityScore.toFixed(3)} |`,
            `| Obsolete Candidate | ${result.obsoleteCandidate ? 'YES' : 'No'} |`,
            '',
        ];
        if (result.evalComparisons.length > 0) {
            lines.push('## Per-Eval Comparison', '');
            lines.push('| Eval ID | Old Baseline | New Baseline | With Skill | Improved |');
            lines.push('|---------|-------------|--------------|------------|----------|');
            for (const c of result.evalComparisons) {
                lines.push(`| ${c.evalId} | ${c.oldBaselinePassed ? 'PASS' : 'FAIL'} | ${c.newBaselinePassed ? 'PASS' : 'FAIL'} | ${c.withSkillPassed ? 'PASS' : 'FAIL'} | ${c.improved ? 'Yes' : 'No'} |`);
            }
            lines.push('');
        }
        if (result.obsoleteCandidate) {
            lines.push('## Recommendation', '', `The new model (${result.newModel}) baseline achieves ${pct(result.newBaselinePassRate)} pass rate,`, `reaching ${pct(result.parityScore)} of the with-skill pass rate (${pct(result.withSkillPassRate)}).`, 'This skill is a **deprecation candidate** — consider retiring it.', '');
        }
        return lines.join('\n');
    }
    getBaselineRows(skillName, modelId) {
        return this.db.prepare(`
      SELECT * FROM model_baseline_results
      WHERE skillName = ? AND modelId = ?
      ORDER BY createdAt ASC
    `).all(skillName, modelId);
    }
    buildComparisons(oldRows, newRows, withSkillRows) {
        const allEvalIds = new Set([
            ...oldRows.map(r => r.evalId),
            ...newRows.map(r => r.evalId),
            ...withSkillRows.map(r => r.evalId),
        ]);
        const oldByEval = new Map(oldRows.map(r => [r.evalId, r]));
        const newByEval = new Map(newRows.map(r => [r.evalId, r]));
        const wsById = new Map(withSkillRows.map(r => [r.evalId, r]));
        return Array.from(allEvalIds).map(evalId => {
            const oldRow = oldByEval.get(evalId);
            const newRow = newByEval.get(evalId);
            const wsRow = wsById.get(evalId);
            const oldBaselinePassed = oldRow?.passed === 1;
            const newBaselinePassed = newRow?.passed === 1;
            const withSkillPassed = wsRow?.passed === 1;
            const prompt = newRow?.prompt ?? oldRow?.prompt ?? wsRow?.prompt ?? evalId;
            return {
                evalId,
                prompt,
                oldBaselinePassed,
                newBaselinePassed,
                withSkillPassed,
                improved: newBaselinePassed && !oldBaselinePassed,
            };
        });
    }
}
// --- Utility functions ---
function computePassRate(rows) {
    if (rows.length === 0)
        return 0;
    const passed = rows.filter(r => r.passed === 1).length;
    return passed / rows.length;
}
function pct(value) {
    return `${(value * 100).toFixed(1)}%`;
}
function rowToParityResult(row) {
    return {
        id: row.id,
        skillName: row.skillName,
        oldModel: row.oldModel,
        newModel: row.newModel,
        oldBaselinePassRate: row.oldBaselinePassRate,
        newBaselinePassRate: row.newBaselinePassRate,
        withSkillPassRate: row.withSkillPassRate,
        parityScore: row.parityScore,
        obsoleteCandidate: row.obsoleteCandidate === 1,
        evalComparisons: JSON.parse(row.evalComparisons),
        timestamp: row.createdAt,
    };
}
//# sourceMappingURL=ParityTester.js.map