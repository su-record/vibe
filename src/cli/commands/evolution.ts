/**
 * Evolution CLI commands
 * vibe evolution <subcommand>
 */

import path from 'path';
import { MemoryStorage } from '../../infra/lib/memory/MemoryStorage.js';
import { GenerationRegistry } from '../../infra/lib/evolution/GenerationRegistry.js';
import { InsightStore } from '../../infra/lib/evolution/InsightStore.js';
import { SkillGapDetector } from '../../infra/lib/evolution/SkillGapDetector.js';
import { InsightExtractor } from '../../infra/lib/evolution/InsightExtractor.js';
import { EvolutionOrchestrator } from '../../infra/lib/evolution/EvolutionOrchestrator.js';
import { LifecycleManager } from '../../infra/lib/evolution/LifecycleManager.js';
import { RollbackManager } from '../../infra/lib/evolution/RollbackManager.js';

function getStorage(): MemoryStorage {
  const projectPath = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return new MemoryStorage(projectPath);
}

export function evolutionStatus(): void {
  const storage = getStorage();
  try {
    const registry = new GenerationRegistry(storage);
    const insightStore = new InsightStore(storage);

    const genStats = registry.getStats();
    const insightStats = insightStore.getStats();

    console.log('\n🧬 Evolution Status');
    console.log('═══════════════════════════════');
    console.log(`\nGenerations: ${genStats.total}`);
    Object.entries(genStats.byStatus).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
    console.log(`\nInsights: ${insightStats.total}`);
    Object.entries(insightStats.byType).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  } finally {
    storage.close();
  }
}

export function evolutionList(): void {
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
      console.log('\nNo generations found.');
      return;
    }

    console.log('\n🧬 Evolution Generations');
    console.log('═══════════════════════════════');
    for (const gen of all) {
      const status = gen.status.toUpperCase().padEnd(8);
      console.log(`  [${status}] ${gen.type}/${gen.name} (${gen.id}) usage=${gen.usageCount}`);
    }
  } finally {
    storage.close();
  }
}

export function evolutionApprove(id: string): void {
  if (!id) { console.log('Usage: vibe evolution approve <id>'); return; }
  const storage = getStorage();
  try {
    const lifecycle = new LifecycleManager(storage);
    const success = lifecycle.approve(id);
    console.log(success ? `✅ Approved: ${id} (draft → testing)` : `❌ Failed: not found or not in draft status`);
  } finally {
    storage.close();
  }
}

export function evolutionReject(id: string): void {
  if (!id) { console.log('Usage: vibe evolution reject <id>'); return; }
  const storage = getStorage();
  try {
    const lifecycle = new LifecycleManager(storage);
    const success = lifecycle.reject(id);
    console.log(success ? `✅ Rejected: ${id}` : `❌ Failed: not found or not in draft status`);
  } finally {
    storage.close();
  }
}

export function evolutionDisable(id: string): void {
  if (!id) { console.log('Usage: vibe evolution disable <id>'); return; }
  const storage = getStorage();
  try {
    const rollback = new RollbackManager(storage);
    rollback.disable(id);
    console.log(`✅ Disabled: ${id}`);
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  } finally {
    storage.close();
  }
}

export function evolutionRollback(id: string): void {
  if (!id) { console.log('Usage: vibe evolution rollback <id>'); return; }
  const storage = getStorage();
  try {
    const rollback = new RollbackManager(storage);
    rollback.rollback(id);
    console.log(`✅ Rolled back: ${id}`);
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  } finally {
    storage.close();
  }
}

export function evolutionDisableAll(): void {
  const storage = getStorage();
  try {
    const rollback = new RollbackManager(storage);
    const result = rollback.emergencyDisableAll();
    console.log(`🚨 Emergency disabled: ${result.disabled} artifacts`);
    if (result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.length}`);
    }
  } finally {
    storage.close();
  }
}

export function evolutionRun(): void {
  const storage = getStorage();
  try {
    const extractor = new InsightExtractor(storage);
    const extractResult = extractor.extractFromRecent(50);
    console.log(`\n📊 Insight Extraction: ${extractResult.newInsights.length} new, ${extractResult.mergedInsights.length} merged`);

    const gapDetector = new SkillGapDetector(storage);
    const gapResult = gapDetector.analyze();
    console.log(`🔍 Skill Gaps: ${gapResult.newGaps.length} new gaps detected`);

    const orchestrator = new EvolutionOrchestrator(storage, { mode: 'suggest' });
    const genResult = orchestrator.generate();
    console.log(`🧬 Generation: ${genResult.generated.length} generated, ${genResult.rejected.length} rejected, ${genResult.errors.length} errors`);
  } finally {
    storage.close();
  }
}

export function evolutionInsights(): void {
  const storage = getStorage();
  try {
    const store = new InsightStore(storage);
    const insights = store.getByStatus('confirmed');

    if (insights.length === 0) {
      console.log('\nNo confirmed insights.');
      return;
    }

    console.log('\n🧠 Confirmed Insights');
    console.log('═══════════════════════════════');
    for (const ins of insights) {
      console.log(`  [${ins.type}] ${ins.title} (conf=${ins.confidence.toFixed(2)}, occ=${ins.occurrences})`);
    }
  } finally {
    storage.close();
  }
}

export function evolutionGaps(): void {
  const storage = getStorage();
  try {
    const store = new InsightStore(storage);
    const gaps = store.getByType('skill_gap');

    if (gaps.length === 0) {
      console.log('\nNo skill gaps detected.');
      return;
    }

    console.log('\n🔍 Detected Skill Gaps');
    console.log('═══════════════════════════════');
    for (const gap of gaps) {
      console.log(`  ${gap.title} (conf=${gap.confidence.toFixed(2)}, occ=${gap.occurrences})`);
    }
  } finally {
    storage.close();
  }
}

export function evolutionHelp(): void {
  console.log(`
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
