/**
 * Evolution CLI commands
 * vibe evolution <subcommand>
 */
import { MemoryStorage } from '../../infra/lib/memory/MemoryStorage.js';
import { GenerationRegistry } from '../../infra/lib/evolution/GenerationRegistry.js';
import { InsightStore } from '../../infra/lib/evolution/InsightStore.js';
import { SkillGapDetector } from '../../infra/lib/evolution/SkillGapDetector.js';
import { InsightExtractor } from '../../infra/lib/evolution/InsightExtractor.js';
import { EvolutionOrchestrator } from '../../infra/lib/evolution/EvolutionOrchestrator.js';
import { LifecycleManager } from '../../infra/lib/evolution/LifecycleManager.js';
import { RollbackManager } from '../../infra/lib/evolution/RollbackManager.js';
import { log } from '../utils.js';
function getStorage() {
    const projectPath = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    return new MemoryStorage(projectPath);
}
export function evolutionStatus() {
    const storage = getStorage();
    try {
        const registry = new GenerationRegistry(storage);
        const insightStore = new InsightStore(storage);
        const genStats = registry.getStats();
        const insightStats = insightStore.getStats();
        log('\n🧬 Evolution Status');
        log('═══════════════════════════════');
        log(`\nGenerations: ${genStats.total}`);
        Object.entries(genStats.byStatus).forEach(([k, v]) => log(`  ${k}: ${v}`));
        log(`\nInsights: ${insightStats.total}`);
        Object.entries(insightStats.byType).forEach(([k, v]) => log(`  ${k}: ${v}`));
    }
    finally {
        storage.close();
    }
}
export function evolutionList() {
    const storage = getStorage();
    try {
        const registry = new GenerationRegistry(storage);
        const all = [
            ...registry.getByStatus('active'),
            ...registry.getByStatus('testing'),
            ...registry.getByStatus('draft'),
            ...registry.getByStatus('disabled'),
        ];
        if (all.length === 0) {
            log('\nNo generations found.');
            return;
        }
        log('\n🧬 Evolution Generations');
        log('═══════════════════════════════');
        for (const gen of all) {
            const status = gen.status.toUpperCase().padEnd(8);
            log(`  [${status}] ${gen.type}/${gen.name} (${gen.id}) usage=${gen.usageCount}`);
        }
    }
    finally {
        storage.close();
    }
}
export function evolutionApprove(id) {
    if (!id) {
        log('Usage: vibe evolution approve <id>');
        return;
    }
    const storage = getStorage();
    try {
        const lifecycle = new LifecycleManager(storage);
        const success = lifecycle.approve(id);
        log(success ? `✅ Approved: ${id} (draft → testing)` : `❌ Failed: not found or not in draft status`);
    }
    finally {
        storage.close();
    }
}
export function evolutionReject(id) {
    if (!id) {
        log('Usage: vibe evolution reject <id>');
        return;
    }
    const storage = getStorage();
    try {
        const lifecycle = new LifecycleManager(storage);
        const success = lifecycle.reject(id);
        log(success ? `✅ Rejected: ${id}` : `❌ Failed: not found or not in draft status`);
    }
    finally {
        storage.close();
    }
}
export function evolutionDisable(id) {
    if (!id) {
        log('Usage: vibe evolution disable <id>');
        return;
    }
    const storage = getStorage();
    try {
        const rollback = new RollbackManager(storage);
        rollback.disable(id);
        log(`✅ Disabled: ${id}`);
    }
    catch (error) {
        log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
    finally {
        storage.close();
    }
}
export function evolutionRollback(id) {
    if (!id) {
        log('Usage: vibe evolution rollback <id>');
        return;
    }
    const storage = getStorage();
    try {
        const rollback = new RollbackManager(storage);
        rollback.rollback(id);
        log(`✅ Rolled back: ${id}`);
    }
    catch (error) {
        log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
    finally {
        storage.close();
    }
}
export function evolutionDisableAll() {
    const storage = getStorage();
    try {
        const rollback = new RollbackManager(storage);
        const result = rollback.emergencyDisableAll();
        log(`🚨 Emergency disabled: ${result.disabled} artifacts`);
        if (result.errors.length > 0) {
            log(`  Errors: ${result.errors.length}`);
        }
    }
    finally {
        storage.close();
    }
}
export function evolutionRun() {
    const storage = getStorage();
    try {
        const extractor = new InsightExtractor(storage);
        const extractResult = extractor.extractFromRecent(50);
        log(`\n📊 Insight Extraction: ${extractResult.newInsights.length} new, ${extractResult.mergedInsights.length} merged`);
        const gapDetector = new SkillGapDetector(storage);
        const gapResult = gapDetector.analyze();
        log(`🔍 Skill Gaps: ${gapResult.newGaps.length} new gaps detected`);
        const orchestrator = new EvolutionOrchestrator(storage, { mode: 'suggest' });
        const genResult = orchestrator.generate();
        log(`🧬 Generation: ${genResult.generated.length} generated, ${genResult.rejected.length} rejected, ${genResult.errors.length} errors`);
    }
    finally {
        storage.close();
    }
}
export function evolutionInsights() {
    const storage = getStorage();
    try {
        const store = new InsightStore(storage);
        const insights = store.getByStatus('confirmed');
        if (insights.length === 0) {
            log('\nNo confirmed insights.');
            return;
        }
        log('\n🧠 Confirmed Insights');
        log('═══════════════════════════════');
        for (const ins of insights) {
            log(`  [${ins.type}] ${ins.title} (conf=${ins.confidence.toFixed(2)}, occ=${ins.occurrences})`);
        }
    }
    finally {
        storage.close();
    }
}
export function evolutionGaps() {
    const storage = getStorage();
    try {
        const store = new InsightStore(storage);
        const gaps = store.getByType('skill_gap');
        if (gaps.length === 0) {
            log('\nNo skill gaps detected.');
            return;
        }
        log('\n🔍 Detected Skill Gaps');
        log('═══════════════════════════════');
        for (const gap of gaps) {
            log(`  ${gap.title} (conf=${gap.confidence.toFixed(2)}, occ=${gap.occurrences})`);
        }
    }
    finally {
        storage.close();
    }
}
export function evolutionHelp() {
    log(`
Evolution Commands:
  vibe evolution status        Show overall status
  vibe evolution list          List all generations
  vibe evolution approve <id>  Approve draft → testing
  vibe evolution reject <id>   Reject draft
  vibe evolution disable <id>  Disable a generation
  vibe evolution rollback <id> Rollback to previous version
  vibe evolution disable-all   Emergency disable all
  vibe evolution run           Manual evolution cycle
  vibe evolution insights      Show confirmed insights
  vibe evolution gaps          Show detected skill gaps
`);
}
//# sourceMappingURL=evolution.js.map