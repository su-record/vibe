// SQLite-based memory management system with Knowledge Graph support (v2.1)
// Refactored facade pattern - delegates to specialized modules

import path from 'path';
import { readFileSync } from 'fs';
import { MemoryRelation, MemoryGraph } from '../types/tool.js';
import { MemoryStorage, MemoryItem } from './memory/MemoryStorage.js';
import { KnowledgeGraph } from './memory/KnowledgeGraph.js';
import { MemorySearch, SearchStrategy, SearchOptions } from './memory/MemorySearch.js';
import { ObservationStore, Observation, ObservationInput, ObservationType } from './memory/ObservationStore.js';
import { SessionRAGStore, Decision, DecisionInput, Constraint, ConstraintInput, Goal, GoalInput, Evidence, EvidenceInput, SessionRAGStats, DecisionStatus, ConstraintType, ConstraintSeverity, GoalStatus, EvidenceType, EvidenceStatus } from './memory/SessionRAGStore.js';
import { SessionRAGRetriever, RetrievalOptions, SessionRAGResult } from './memory/SessionRAGRetriever.js';

// Re-export for backward compatibility
export { MemoryItem } from './memory/MemoryStorage.js';
export { Observation, ObservationInput, ObservationType } from './memory/ObservationStore.js';
export { Decision, DecisionInput, Constraint, ConstraintInput, Goal, GoalInput, Evidence, EvidenceInput, SessionRAGStats, DecisionStatus, ConstraintType, ConstraintSeverity, GoalStatus, EvidenceType, EvidenceStatus } from './memory/SessionRAGStore.js';
export { RetrievalOptions, SessionRAGResult } from './memory/SessionRAGRetriever.js';

export class MemoryManager {
  private storage: MemoryStorage;
  private graph: KnowledgeGraph;
  private memorySearch: MemorySearch;
  private observations: ObservationStore;
  private sessionRAG: SessionRAGStore;
  private ragRetriever: SessionRAGRetriever;

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
    this.observations = new ObservationStore(this.storage);
    this.sessionRAG = new SessionRAGStore(this.storage);
    this.ragRetriever = new SessionRAGRetriever(this.storage, this.sessionRAG);
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
  // Observation Operations (delegated to ObservationStore)
  // ============================================================================

  public addObservation(input: ObservationInput): number {
    return this.observations.add(input);
  }

  public searchObservations(query: string, limit: number = 20): Observation[] {
    return this.observations.search(query, limit);
  }

  public getRecentObservations(limit: number = 10, type?: ObservationType): Observation[] {
    return this.observations.getRecent(limit, type);
  }

  public getObservationsBySession(sessionId: string, limit: number = 50): Observation[] {
    return this.observations.getBySession(sessionId, limit);
  }

  public getObservationStats(): { total: number; byType: Record<string, number> } {
    return this.observations.getStats();
  }

  // ============================================================================
  // Session RAG Operations (delegated to SessionRAGStore/Retriever)
  // ============================================================================

  // Decisions
  public addDecision(input: DecisionInput): number {
    return this.sessionRAG.addDecision(input);
  }

  public getDecision(id: number): Decision | null {
    return this.sessionRAG.getDecision(id);
  }

  public updateDecision(id: number, updates: Partial<DecisionInput>): boolean {
    return this.sessionRAG.updateDecision(id, updates);
  }

  public listDecisions(sessionId?: string, status?: DecisionStatus, limit?: number): Decision[] {
    return this.sessionRAG.listDecisions(sessionId, status, limit);
  }

  public searchDecisions(query: string, limit?: number): Decision[] {
    return this.sessionRAG.searchDecisions(query, limit);
  }

  // Constraints
  public addConstraint(input: ConstraintInput): number {
    return this.sessionRAG.addConstraint(input);
  }

  public getConstraint(id: number): Constraint | null {
    return this.sessionRAG.getConstraint(id);
  }

  public updateConstraint(id: number, updates: Partial<ConstraintInput>): boolean {
    return this.sessionRAG.updateConstraint(id, updates);
  }

  public listConstraints(sessionId?: string, type?: ConstraintType, severity?: ConstraintSeverity, limit?: number): Constraint[] {
    return this.sessionRAG.listConstraints(sessionId, type, severity, limit);
  }

  // Goals
  public addGoal(input: GoalInput): number {
    return this.sessionRAG.addGoal(input);
  }

  public getGoal(id: number): Goal | null {
    return this.sessionRAG.getGoal(id);
  }

  public updateGoal(id: number, updates: Partial<GoalInput>): boolean {
    return this.sessionRAG.updateGoal(id, updates);
  }

  public getActiveGoals(limit?: number): Goal[] {
    return this.sessionRAG.getActiveGoals(limit);
  }

  public listGoals(sessionId?: string, status?: GoalStatus, limit?: number): Goal[] {
    return this.sessionRAG.listGoals(sessionId, status, limit);
  }

  // Evidence
  public addEvidence(input: EvidenceInput): number {
    return this.sessionRAG.addEvidence(input);
  }

  public getEvidence(id: number): Evidence | null {
    return this.sessionRAG.getEvidence(id);
  }

  public listEvidence(sessionId?: string, type?: EvidenceType, status?: EvidenceStatus, limit?: number): Evidence[] {
    return this.sessionRAG.listEvidence(sessionId, type, status, limit);
  }

  // Retrieval
  public retrieveSessionContext(options: RetrievalOptions): SessionRAGResult {
    return this.ragRetriever.retrieve(options);
  }

  public retrieveActiveContext(): { goals: Goal[]; constraints: Constraint[]; decisions: Decision[] } {
    return this.ragRetriever.retrieveActiveContext();
  }

  public getSessionRAGStats(): SessionRAGStats {
    return this.sessionRAG.getStats();
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
