// Evolution Orchestrator for self-evolution Phase 3
// Manages the full generation pipeline: insight → artifact

import path from 'path';
import { mkdirSync, writeFileSync, unlinkSync, renameSync, existsSync, readdirSync } from 'fs';
import { MemoryStorage } from '../memory/MemoryStorage.js';
import { InsightStore, Insight } from './InsightStore.js';
import { GenerationRegistry, GenerationInput } from './GenerationRegistry.js';
import { SkillGenerator } from './generators/SkillGenerator.js';
import { AgentGenerator } from './generators/AgentGenerator.js';
import { RuleGenerator } from './generators/RuleGenerator.js';
import { TriggerCollisionDetector } from './TriggerCollisionDetector.js';

export interface OrchestrationResult {
  generated: string[];
  rejected: string[];
  errors: string[];
}

interface EvolutionConfig {
  mode: 'suggest' | 'auto';
  maxGenerationsPerCycle: number;
  minQualityScore: number;
}

const FILENAME_REGEX = /^[a-z0-9-]+\.md$/;
const MAX_AUTO_FILES = 50;

function getAutoDir(type: 'skill' | 'agent' | 'rule'): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  switch (type) {
    case 'skill': return path.join(home, '.claude', 'vibe', 'skills', 'auto');
    case 'agent': return path.join(home, '.claude', 'agents', 'auto');
    case 'rule': return path.join(home, '.claude', 'vibe', 'rules', 'auto');
  }
}

export class EvolutionOrchestrator {
  private insightStore: InsightStore;
  private registry: GenerationRegistry;
  private skillGen: SkillGenerator;
  private agentGen: AgentGenerator;
  private ruleGen: RuleGenerator;
  private collisionDetector: TriggerCollisionDetector;
  private config: EvolutionConfig;

  constructor(storage: MemoryStorage, config?: Partial<EvolutionConfig>) {
    this.insightStore = new InsightStore(storage);
    this.registry = new GenerationRegistry(storage);
    this.skillGen = new SkillGenerator();
    this.agentGen = new AgentGenerator();
    this.ruleGen = new RuleGenerator();
    this.collisionDetector = new TriggerCollisionDetector();
    this.config = {
      mode: config?.mode || 'suggest',
      maxGenerationsPerCycle: config?.maxGenerationsPerCycle || 5,
      minQualityScore: config?.minQualityScore || 60,
    };
  }

  /**
   * Run a full generation cycle
   */
  public generate(): OrchestrationResult {
    const result: OrchestrationResult = { generated: [], rejected: [], errors: [] };

    const actionable = this.insightStore.getActionable();
    let count = 0;

    for (const insight of actionable) {
      if (count >= this.config.maxGenerationsPerCycle) break;

      try {
        const generated = this.generateFromInsight(insight);
        if (generated) {
          result.generated.push(generated);
          count++;
        } else {
          result.rejected.push(insight.id);
        }
      } catch (error) {
        result.errors.push(`${insight.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }

  private generateFromInsight(insight: Insight): string | null {
    // Determine generator based on insight type
    if (insight.type === 'skill_gap' || insight.type === 'pattern') {
      // Try agent first for complex insights
      const agent = this.agentGen.generate(insight);
      if (agent) {
        return this.saveGeneration(insight, 'agent', agent.name, agent.content, []);
      }
      // Fall back to skill
      const skill = this.skillGen.generate(insight);
      if (skill) {
        return this.saveGeneration(insight, 'skill', skill.name, skill.content, skill.triggerPatterns);
      }
    }

    if (insight.type === 'anti_pattern' || insight.type === 'pattern') {
      const rule = this.ruleGen.generate(insight);
      if (rule) {
        return this.saveGeneration(insight, 'rule', rule.name, rule.content, []);
      }
    }

    return null;
  }

  private saveGeneration(
    insight: Insight,
    type: 'skill' | 'agent' | 'rule',
    name: string,
    content: string,
    triggerPatterns: string[]
  ): string | null {
    // Validate filename
    const filename = `${name}.md`;
    if (!FILENAME_REGEX.test(filename)) {
      process.stderr.write(`[Evolution] Invalid filename: ${filename}\n`);
      return null;
    }

    // Trigger collision check for skills
    if (type === 'skill' && triggerPatterns.length > 0) {
      const existingSkills = this.registry.getActive('skill').map(g => ({
        name: g.name,
        triggers: g.triggerPatterns,
      }));
      const collision = this.collisionDetector.checkCollision(triggerPatterns, existingSkills);
      if (collision.type === 'exact' || collision.type === 'circular') {
        return null;
      }
    }

    // Quality score: simple heuristic (template-based, no LLM)
    const qualityScore = this.calculateQualityScore(content);
    if (qualityScore < this.config.minQualityScore) {
      return null;
    }

    const autoDir = getAutoDir(type);
    const filePath = path.join(autoDir, filename);

    // Path traversal check
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(autoDir))) {
      process.stderr.write(`[Evolution] Path traversal detected: ${filePath}\n`);
      return null;
    }

    const status = this.config.mode === 'auto' ? 'testing' : 'draft';

    // Atomic: write to temp, register in DB, then rename
    const tmpPath = path.join(autoDir, `.tmp-${name}.md`);

    try {
      mkdirSync(autoDir, { recursive: true });

      // Enforce max file limit
      this.enforceFileLimit(autoDir);

      // Write temp file
      writeFileSync(tmpPath, content, 'utf-8');

      // Register in DB (transaction)
      const id = this.registry.save({
        insightId: insight.id,
        type,
        name,
        content,
        filePath: resolvedPath,
        status,
        qualityScore,
        triggerPatterns,
      });

      // Rename to final
      renameSync(tmpPath, filePath);

      // Update insight
      this.insightStore.setAppliedAs(insight.id, id);

      return id;
    } catch (error) {
      // Cleanup temp file
      try { unlinkSync(tmpPath); } catch { /* ignore */ }
      throw error;
    }
  }

  private calculateQualityScore(content: string): number {
    let score = 50; // Base

    // Length check
    if (content.length > 100) score += 10;
    if (content.length > 500) score += 10;

    // Has structure (frontmatter)
    if (content.includes('---')) score += 10;

    // Has title
    if (content.includes('# ')) score += 10;

    // Has description
    if (content.split('\n').length > 5) score += 10;

    return Math.min(100, score);
  }

  private enforceFileLimit(dir: string): void {
    try {
      const files = readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('.tmp-'));
      if (files.length >= MAX_AUTO_FILES) {
        // Find and delete oldest disabled files
        const disabled = this.registry.getByStatus('disabled', 10);
        for (const gen of disabled) {
          if (gen.filePath && existsSync(gen.filePath)) {
            try { unlinkSync(gen.filePath); } catch { /* ignore */ }
          }
          this.registry.updateStatus(gen.id, 'deleted');
        }
      }
    } catch { /* directory might not exist yet */ }
  }

  /**
   * Cleanup temporary files left from failed generations
   */
  public cleanupTempFiles(): void {
    for (const type of ['skill', 'agent', 'rule'] as const) {
      const dir = getAutoDir(type);
      try {
        const files = readdirSync(dir).filter(f => f.startsWith('.tmp-'));
        for (const file of files) {
          try { unlinkSync(path.join(dir, file)); } catch { /* ignore */ }
        }
      } catch { /* directory doesn't exist */ }
    }
  }
}
