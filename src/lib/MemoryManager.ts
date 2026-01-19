// SQLite-based memory management system with Knowledge Graph support (v2.1)
// Refactored facade pattern - delegates to specialized modules

import path from 'path';
import { readFileSync } from 'fs';
import { MemoryRelation, MemoryGraph } from '../types/tool.js';
import { MemoryStorage, MemoryItem } from './memory/MemoryStorage.js';
import { KnowledgeGraph } from './memory/KnowledgeGraph.js';
import { MemorySearch, SearchStrategy, SearchOptions } from './memory/MemorySearch.js';

// Re-export for backward compatibility
export { MemoryItem } from './memory/MemoryStorage.js';

export class MemoryManager {
  private storage: MemoryStorage;
  private graph: KnowledgeGraph;
  private memorySearch: MemorySearch;

  // Map of projectPath -> MemoryManager instance (for project-based memory)
  private static instances: Map<string, MemoryManager> = new Map();
  // Legacy single instance (for backward compatibility)
  private static instance: MemoryManager | null = null;
  private static cleanupRegistered = false;

  private constructor(projectPath?: string) {
    // Determine project path
    let resolvedPath = projectPath;

    if (!resolvedPath && process.env.CLAUDE_PROJECT_DIR) {
      resolvedPath = process.env.CLAUDE_PROJECT_DIR;
    }

    if (!resolvedPath) {
      // Only use cwd if it looks like a real project (has .claude folder)
      const cwdClaudePath = path.join(process.cwd(), '.claude');
      try {
        const fs = require('fs');
        if (fs.existsSync(cwdClaudePath)) {
          resolvedPath = process.cwd();
        }
      } catch {
        // Ignore errors
      }
    }

    if (!resolvedPath) {
      throw new Error('No valid project path found. Provide projectPath or set CLAUDE_PROJECT_DIR environment variable.');
    }

    // Normalize path
    resolvedPath = path.resolve(resolvedPath);

    // Skip memory creation for vibe package itself
    if (this.isVibePackage(resolvedPath)) {
      throw new Error('Memory storage disabled for vibe package development folder.');
    }

    // Initialize modules
    this.storage = new MemoryStorage(resolvedPath);
    this.graph = new KnowledgeGraph(this.storage);
    this.memorySearch = new MemorySearch(this.storage, this.graph);
  }

  /**
   * Check if the given path is the vibe package itself
   */
  private isVibePackage(projectPath: string): boolean {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.name === '@su-record/vibe';
    } catch {
      return false;
    }
  }

  /**
   * Get MemoryManager instance for a specific project
   */
  public static getInstance(projectPath?: string): MemoryManager {
    if (projectPath) {
      const normalizedPath = path.resolve(projectPath);

      if (!MemoryManager.instances.has(normalizedPath)) {
        MemoryManager.instances.set(normalizedPath, new MemoryManager(normalizedPath));
      }

      return MemoryManager.instances.get(normalizedPath)!;
    }

    // Legacy behavior: single global instance
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();

      if (!MemoryManager.cleanupRegistered) {
        MemoryManager.cleanupRegistered = true;
        process.setMaxListeners(Math.max(process.getMaxListeners(), 15));

        const cleanup = () => {
          if (MemoryManager.instance) {
            MemoryManager.instance.close();
          }
          for (const instance of MemoryManager.instances.values()) {
            instance.close();
          }
          MemoryManager.instances.clear();
        };

        process.on('exit', cleanup);
        process.on('SIGINT', () => {
          cleanup();
          process.exit(0);
        });
        process.on('SIGTERM', () => {
          cleanup();
          process.exit(0);
        });
      }
    }
    return MemoryManager.instance;
  }

  // ============================================================================
  // Core Storage Operations (delegated to MemoryStorage)
  // ============================================================================

  public save(key: string, value: string, category: string = 'general', priority: number = 0): void {
    this.storage.save(key, value, category, priority);
  }

  public recall(key: string): MemoryItem | null {
    return this.storage.recall(key);
  }

  public delete(key: string): boolean {
    return this.storage.delete(key);
  }

  public update(key: string, value: string): boolean {
    return this.storage.update(key, value);
  }

  public list(category?: string): MemoryItem[] {
    return this.storage.list(category);
  }

  public getByPriority(priority: number): MemoryItem[] {
    return this.storage.getByPriority(priority);
  }

  public setPriority(key: string, priority: number): boolean {
    return this.storage.setPriority(key, priority);
  }

  public getStats(): { total: number; byCategory: Record<string, number> } {
    return this.storage.getStats();
  }

  public getTimeline(startDate?: string, endDate?: string, limit: number = 50): MemoryItem[] {
    return this.storage.getTimeline(startDate, endDate, limit);
  }

  public getDbPath(): string {
    return this.storage.getDbPath();
  }

  // ============================================================================
  // Knowledge Graph Operations (delegated to KnowledgeGraph)
  // ============================================================================

  public linkMemories(
    sourceKey: string,
    targetKey: string,
    relationType: string,
    strength: number = 1.0,
    metadata?: Record<string, unknown>
  ): boolean {
    return this.graph.linkMemories(sourceKey, targetKey, relationType, strength, metadata);
  }

  public getRelations(key: string, direction: 'outgoing' | 'incoming' | 'both' = 'both'): MemoryRelation[] {
    return this.graph.getRelations(key, direction);
  }

  public getRelatedMemories(key: string, depth: number = 1, relationType?: string): MemoryItem[] {
    return this.graph.getRelatedMemories(key, depth, relationType);
  }

  public getMemoryGraph(key?: string, depth: number = 2): MemoryGraph {
    return this.graph.getMemoryGraph(key, depth);
  }

  public findPath(sourceKey: string, targetKey: string): string[] | null {
    return this.graph.findPath(sourceKey, targetKey);
  }

  public unlinkMemories(sourceKey: string, targetKey: string, relationType?: string): boolean {
    return this.graph.unlinkMemories(sourceKey, targetKey, relationType);
  }

  // ============================================================================
  // Search Operations (delegated to MemorySearch)
  // ============================================================================

  public search(query: string): MemoryItem[] {
    return this.storage.search(query);
  }

  public searchAdvanced(
    query: string,
    strategy: SearchStrategy,
    options: SearchOptions = {}
  ): MemoryItem[] {
    return this.memorySearch.searchAdvanced(query, strategy, options);
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  public close(): void {
    this.storage.close();
  }

  public static resetInstance(projectPath?: string): void {
    if (projectPath) {
      const normalizedPath = path.resolve(projectPath);
      const instance = MemoryManager.instances.get(normalizedPath);
      if (instance) {
        instance.close();
        MemoryManager.instances.delete(normalizedPath);
      }
    } else {
      if (MemoryManager.instance) {
        MemoryManager.instance.close();
        MemoryManager.instance = null;
      }
      for (const instance of MemoryManager.instances.values()) {
        instance.close();
      }
      MemoryManager.instances.clear();
    }
  }
}
