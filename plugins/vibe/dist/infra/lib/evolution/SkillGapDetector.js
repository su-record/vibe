// Skill Gap Detection for self-evolution Phase 2
// Detects missing skills from prompt-dispatcher misses
import { randomUUID } from 'crypto';
import { InsightStore } from './InsightStore.js';
export class SkillGapDetector {
    db;
    insightStore;
    constructor(storage) {
        this.db = storage.getDatabase();
        this.insightStore = new InsightStore(storage);
    }
    /**
     * Log a prompt-dispatcher miss
     */
    logMiss(prompt, sessionId) {
        const id = `gap-${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
        const truncated = prompt.slice(0, 200);
        const normalized = truncated.toLowerCase().replace(/\s+/g, ' ').trim();
        try {
            this.db.prepare(`
        INSERT INTO skill_gaps (id, prompt, normalizedPrompt, sessionId, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, truncated, normalized, sessionId || null, new Date().toISOString());
        }
        catch {
            // Silent fail — gap logging is non-critical
        }
    }
    /**
     * Analyze accumulated gaps and generate skill_gap insights
     */
    analyze(limit = 100) {
        const result = { newGaps: [], totalClusters: 0 };
        try {
            // Cluster by normalizedPrompt
            const clusters = this.db.prepare(`
        SELECT normalizedPrompt, COUNT(*) as count, GROUP_CONCAT(prompt, '|||') as prompts
        FROM skill_gaps
        GROUP BY normalizedPrompt
        HAVING count >= 3
        ORDER BY count DESC
        LIMIT ?
      `).all(limit);
            result.totalClusters = clusters.length;
            for (const cluster of clusters) {
                const prompts = cluster.prompts.split('|||').slice(0, 5);
                // Check for duplicate insight
                const existingId = this.insightStore.findAndMergeDuplicate(`Skill gap: ${cluster.normalizedPrompt}`, '');
                if (existingId)
                    continue;
                const id = this.insightStore.save({
                    type: 'skill_gap',
                    title: `Skill gap: ${cluster.normalizedPrompt}`,
                    description: `${cluster.count}회 매칭 실패. 예시: ${prompts[0]}`,
                    evidence: prompts,
                    confidence: Math.min(1.0, cluster.count * 0.2),
                    tags: ['auto-detected', 'gap'],
                    generatedFrom: 'observation',
                });
                result.newGaps.push(id);
            }
        }
        catch {
            // skill_gaps table might not exist yet
        }
        return result;
    }
    /**
     * Get gap log count
     */
    getGapCount() {
        try {
            const result = this.db.prepare(`SELECT COUNT(*) as cnt FROM skill_gaps`).get();
            return result.cnt;
        }
        catch {
            return 0;
        }
    }
}
//# sourceMappingURL=SkillGapDetector.js.map