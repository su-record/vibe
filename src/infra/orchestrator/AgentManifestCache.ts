/**
 * AgentManifestCache - Two-tier agent loading with LRU cache
 * Lightweight manifests at warmup, full content on demand
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { parseAgentMarkdown, extractCategory } from './agentDiscovery.js';
import { TokenBudgetTracker } from '../lib/TokenBudgetTracker.js';
import { TOKENS } from '../lib/constants.js';

// ============================================================================
// Types
// ============================================================================

export interface AgentManifest {
  name: string;
  path: string;
  category: string;
  description: string;
  estimatedTokens: number;
}

export interface CachedFullAgent {
  manifest: AgentManifest;
  content: string;
  loadedAt: number;
  lastAccess: number;
}

export interface AgentCacheStats {
  manifestCount: number;
  fullCacheSize: number;
  fullCacheMaxSize: number;
  totalEstimatedTokens: number;
  categories: string[];
}

// ============================================================================
// Constants
// ============================================================================

const AGENTS_DIRS = ['.claude/agents', 'agents'];
const WARMUP_PREVIEW_LINES = 20;
const DEFAULT_MAX_FULL_CACHE = 5;

// ============================================================================
// AgentManifestCache
// ============================================================================

export class AgentManifestCache {
  private static instances: Map<string, AgentManifestCache> = new Map();
  private static defaultInstance: AgentManifestCache | null = null;

  private manifests: Map<string, AgentManifest> = new Map();
  private fullCache: Map<string, CachedFullAgent> = new Map();
  private accessOrder: string[] = [];
  private maxFullCacheSize: number;
  private projectPath: string;
  private agentsBasePath: string | null = null;

  private constructor(projectPath: string, maxFullCacheSize: number) {
    this.projectPath = projectPath;
    this.maxFullCacheSize = maxFullCacheSize;
  }

  static getInstance(
    projectPath: string = process.cwd(),
    maxFullCacheSize: number = DEFAULT_MAX_FULL_CACHE,
  ): AgentManifestCache {
    const existing = AgentManifestCache.instances.get(projectPath);
    if (existing) return existing;
    const inst = new AgentManifestCache(projectPath, maxFullCacheSize);
    AgentManifestCache.instances.set(projectPath, inst);
    return inst;
  }

  async warmUp(): Promise<void> {
    this.agentsBasePath = await this.findAgentsDir();
    if (!this.agentsBasePath) return;

    const files = await glob('**/*.md', {
      cwd: this.agentsBasePath,
      absolute: true,
    });

    for (const filePath of files) {
      try {
        const content = await this.readPreview(filePath);
        const stat = await fs.stat(filePath);
        const parsed = parseAgentMarkdown(content, filePath);
        const category = extractCategory(
          filePath,
          this.agentsBasePath,
        );
        const estimatedTokens = Math.ceil(
          stat.size * TOKENS.PER_CHAR_ESTIMATE,
        );
        const name = parsed.name || path.basename(filePath, '.md');

        this.manifests.set(name, {
          name,
          path: path.relative(this.projectPath, filePath),
          category,
          description: parsed.description || '',
          estimatedTokens,
        });
      } catch {
        // Skip individual file errors
      }
    }
  }

  getManifest(name: string): AgentManifest | null {
    return this.manifests.get(name) ?? null;
  }

  async getFullAgent(name: string): Promise<CachedFullAgent | null> {
    const cached = this.fullCache.get(name);
    if (cached) {
      cached.lastAccess = Date.now();
      this.touchAccessOrder(name);
      return cached;
    }

    const manifest = this.manifests.get(name);
    if (!manifest) return null;

    try {
      const fullPath = path.resolve(this.projectPath, manifest.path);
      const content = await fs.readFile(fullPath, 'utf-8');
      const entry: CachedFullAgent = {
        manifest,
        content,
        loadedAt: Date.now(),
        lastAccess: Date.now(),
      };

      this.evictIfNeeded();
      this.fullCache.set(name, entry);
      this.accessOrder.push(name);
      return entry;
    } catch {
      return null;
    }
  }

  listByCategory(category: string): AgentManifest[] {
    return [...this.manifests.values()].filter(
      m => m.category === category,
    );
  }

  listAll(): AgentManifest[] {
    return [...this.manifests.values()];
  }

  estimateTokenCost(
    names: string[],
  ): { total: number; breakdown: Record<string, number>; wouldExceedBudget: boolean } {
    const breakdown: Record<string, number> = {};
    let total = 0;

    for (const name of names) {
      const manifest = this.manifests.get(name);
      if (manifest) {
        breakdown[name] = manifest.estimatedTokens;
        total += manifest.estimatedTokens;
      }
    }

    let wouldExceedBudget = false;
    try {
      const tracker = TokenBudgetTracker.getInstance(this.projectPath);
      wouldExceedBudget = total > tracker.getRemainingBudget();
    } catch {
      // Tracker not available
    }

    return { total, breakdown, wouldExceedBudget };
  }

  getStats(): AgentCacheStats {
    const categories = new Set<string>();
    let totalEstimatedTokens = 0;

    for (const m of this.manifests.values()) {
      categories.add(m.category);
      totalEstimatedTokens += m.estimatedTokens;
    }

    return {
      manifestCount: this.manifests.size,
      fullCacheSize: this.fullCache.size,
      fullCacheMaxSize: this.maxFullCacheSize,
      totalEstimatedTokens,
      categories: [...categories],
    };
  }

  invalidate(): void {
    this.manifests.clear();
    this.fullCache.clear();
    this.accessOrder = [];
  }

  static resetInstance(): void {
    AgentManifestCache.instances.clear();
    AgentManifestCache.defaultInstance = null;
  }

  // ========================================================================
  // Private helpers
  // ========================================================================

  private async findAgentsDir(): Promise<string | null> {
    for (const dir of AGENTS_DIRS) {
      const candidate = path.join(this.projectPath, dir);
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // Try next
      }
    }
    return null;
  }

  private async readPreview(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    return lines.slice(0, WARMUP_PREVIEW_LINES).join('\n');
  }

  private evictIfNeeded(): void {
    while (this.fullCache.size >= this.maxFullCacheSize) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.fullCache.delete(oldest);
      } else {
        break;
      }
    }
  }

  private touchAccessOrder(name: string): void {
    const idx = this.accessOrder.indexOf(name);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
    this.accessOrder.push(name);
  }
}
