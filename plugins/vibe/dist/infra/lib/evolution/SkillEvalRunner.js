// Skill Eval Runner - Phase 5: Test, Measure, and Refine
// Defines and runs evals for skills, tracking pass/fail per assertion
//
// Inspired by Anthropic's skill-creator eval framework:
// - Define eval cases with prompts and expected outputs
// - Run with-skill vs baseline comparisons
// - Grade results against assertions
// - Aggregate into benchmarks
import { randomUUID } from 'crypto';
export class SkillEvalRunner {
    db;
    constructor(storage) {
        this.db = storage.getDatabase();
        this.initializeTables();
    }
    initializeTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS skill_eval_cases (
        id TEXT PRIMARY KEY,
        skillName TEXT NOT NULL,
        prompt TEXT NOT NULL,
        expectedOutput TEXT NOT NULL,
        files TEXT DEFAULT '[]',
        assertions TEXT DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sec_skill ON skill_eval_cases(skillName);

      CREATE TABLE IF NOT EXISTS skill_eval_runs (
        id TEXT PRIMARY KEY,
        evalId TEXT NOT NULL,
        skillName TEXT NOT NULL,
        variant TEXT NOT NULL CHECK(variant IN ('with_skill','baseline')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','passed','failed','error')),
        output TEXT DEFAULT '',
        grades TEXT DEFAULT '[]',
        durationMs INTEGER DEFAULT 0,
        tokenCount INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ser_eval ON skill_eval_runs(evalId);
      CREATE INDEX IF NOT EXISTS idx_ser_skill ON skill_eval_runs(skillName);
      CREATE INDEX IF NOT EXISTS idx_ser_variant ON skill_eval_runs(variant);
    `);
    }
    /**
     * Create an eval set for a skill
     */
    createEvalSet(input) {
        const cases = [];
        const now = new Date().toISOString();
        const insertStmt = this.db.prepare(`
      INSERT INTO skill_eval_cases (id, skillName, prompt, expectedOutput, files, assertions, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const insertMany = this.db.transaction((evals) => {
            for (const evalCase of evals) {
                const id = `eval-${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
                const assertions = (evalCase.assertions ?? []).map(a => ({
                    id: `assert-${randomUUID().replace(/-/g, '').slice(0, 8)}`,
                    description: a.description,
                    type: a.type,
                    value: a.value,
                }));
                insertStmt.run(id, input.skillName, evalCase.prompt, evalCase.expectedOutput, JSON.stringify(evalCase.files ?? []), JSON.stringify(assertions), now, now);
                cases.push({
                    id,
                    skillName: input.skillName,
                    prompt: evalCase.prompt,
                    expectedOutput: evalCase.expectedOutput,
                    files: evalCase.files ?? [],
                    assertions,
                });
            }
        });
        insertMany(input.evals);
        return cases;
    }
    /**
     * Get all eval cases for a skill
     */
    getEvalCases(skillName) {
        const rows = this.db.prepare(`
      SELECT * FROM skill_eval_cases WHERE skillName = ? ORDER BY createdAt ASC
    `).all(skillName);
        return rows.map(this.rowToEvalCase);
    }
    /**
     * Get a single eval case by ID
     */
    getEvalCase(evalId) {
        const row = this.db.prepare(`
      SELECT * FROM skill_eval_cases WHERE id = ?
    `).get(evalId);
        return row ? this.rowToEvalCase(row) : null;
    }
    /**
     * Record the start of an eval run
     */
    startRun(evalId, skillName, variant) {
        const id = `run-${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
        const now = new Date().toISOString();
        this.db.prepare(`
      INSERT INTO skill_eval_runs (id, evalId, skillName, variant, status, createdAt)
      VALUES (?, ?, ?, ?, 'running', ?)
    `).run(id, evalId, skillName, variant, now);
        return id;
    }
    /**
     * Complete an eval run with output and grades
     */
    completeRun(runId, output, grades, durationMs, tokenCount) {
        const allPassed = grades.length === 0 || grades.every(g => g.passed);
        const status = allPassed ? 'passed' : 'failed';
        this.db.prepare(`
      UPDATE skill_eval_runs
      SET status = ?, output = ?, grades = ?, durationMs = ?, tokenCount = ?
      WHERE id = ?
    `).run(status, output, JSON.stringify(grades), durationMs, tokenCount, runId);
    }
    /**
     * Mark a run as errored
     */
    failRun(runId, errorMessage) {
        this.db.prepare(`
      UPDATE skill_eval_runs SET status = 'error', output = ? WHERE id = ?
    `).run(errorMessage, runId);
    }
    /**
     * Grade output against assertions
     */
    gradeOutput(output, assertions) {
        return assertions.map(assertion => {
            let passed = false;
            let evidence = '';
            switch (assertion.type) {
                case 'contains':
                    passed = output.includes(assertion.value);
                    evidence = passed
                        ? `Output contains "${assertion.value}"`
                        : `Output does not contain "${assertion.value}"`;
                    break;
                case 'not_contains':
                    passed = !output.includes(assertion.value);
                    evidence = passed
                        ? `Output correctly excludes "${assertion.value}"`
                        : `Output unexpectedly contains "${assertion.value}"`;
                    break;
                case 'matches_regex': {
                    try {
                        const regex = new RegExp(assertion.value);
                        passed = regex.test(output);
                        evidence = passed
                            ? `Output matches pattern /${assertion.value}/`
                            : `Output does not match pattern /${assertion.value}/`;
                    }
                    catch {
                        passed = false;
                        evidence = `Invalid regex pattern: ${assertion.value}`;
                    }
                    break;
                }
                case 'custom':
                    // Custom assertions require external grading (LLM or script)
                    passed = false;
                    evidence = 'Custom assertion requires external grading';
                    break;
            }
            return {
                assertionId: assertion.id,
                description: assertion.description,
                passed,
                evidence,
            };
        });
    }
    /**
     * Get all runs for an eval case
     */
    getRunsForEval(evalId) {
        const rows = this.db.prepare(`
      SELECT * FROM skill_eval_runs WHERE evalId = ? ORDER BY createdAt DESC
    `).all(evalId);
        return rows.map(this.rowToRunResult);
    }
    /**
     * Get all runs for a skill
     */
    getRunsForSkill(skillName) {
        const rows = this.db.prepare(`
      SELECT * FROM skill_eval_runs WHERE skillName = ? ORDER BY createdAt DESC
    `).all(skillName);
        return rows.map(this.rowToRunResult);
    }
    /**
     * Get latest runs grouped by eval and variant
     */
    getLatestRuns(skillName) {
        const runs = this.getRunsForSkill(skillName);
        const grouped = new Map();
        for (const run of runs) {
            if (!grouped.has(run.evalId)) {
                grouped.set(run.evalId, { withSkill: null, baseline: null });
            }
            const entry = grouped.get(run.evalId);
            if (run.variant === 'with_skill' && !entry.withSkill) {
                entry.withSkill = run;
            }
            else if (run.variant === 'baseline' && !entry.baseline) {
                entry.baseline = run;
            }
        }
        return grouped;
    }
    /**
     * Delete all eval cases and runs for a skill
     */
    deleteEvalSet(skillName) {
        const deleteRuns = this.db.prepare(`DELETE FROM skill_eval_runs WHERE skillName = ?`);
        const deleteCases = this.db.prepare(`DELETE FROM skill_eval_cases WHERE skillName = ?`);
        const transaction = this.db.transaction(() => {
            deleteRuns.run(skillName);
            const result = deleteCases.run(skillName);
            return result.changes;
        });
        return transaction();
    }
    rowToEvalCase(row) {
        return {
            id: row.id,
            skillName: row.skillName,
            prompt: row.prompt,
            expectedOutput: row.expectedOutput,
            files: JSON.parse(row.files),
            assertions: JSON.parse(row.assertions),
        };
    }
    rowToRunResult(row) {
        return {
            evalId: row.evalId,
            runId: row.id,
            skillName: row.skillName,
            variant: row.variant,
            status: row.status,
            output: row.output,
            grades: JSON.parse(row.grades),
            durationMs: row.durationMs,
            tokenCount: row.tokenCount,
            createdAt: row.createdAt,
        };
    }
}
//# sourceMappingURL=SkillEvalRunner.js.map