// SQLite-based memory management system with Knowledge Graph support (v2.1)
// Refactored facade pattern - delegates to specialized modules
import path from 'path';
import { readFileSync } from 'fs';
import { MemoryStorage } from './memory/MemoryStorage.js';
import { KnowledgeGraph } from './memory/KnowledgeGraph.js';
import { MemorySearch } from './memory/MemorySearch.js';
import { ObservationStore } from './memory/ObservationStore.js';
import { SessionRAGStore } from './memory/SessionRAGStore.js';
import { SessionRAGRetriever } from './memory/SessionRAGRetriever.js';
import { ReflectionStore } from './memory/ReflectionStore.js';
export class MemoryManager {
    storage;
    graph;
    memorySearch;
    observations;
    sessionRAG;
    ragRetriever;
    reflections;
    // Map of projectPath -> MemoryManager instance (for project-based memory)
    static instances = new Map();
    static instance = null;
    static cleanupRegistered = false;
    constructor(projectPath) {
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
            }
            catch {
                // Ignore errors
            }
        }
        if (!resolvedPath) {
            throw new Error('No valid project path found. Provide projectPath or set CLAUDE_PROJECT_DIR environment variable.');
        }
        // Normalize path
        resolvedPath = path.resolve(resolvedPath);
        // Skip memory creation for core package itself
        if (this.isCorePackage(resolvedPath)) {
            throw new Error('Memory storage disabled for core package development folder.');
        }
        // Initialize modules
        this.storage = new MemoryStorage(resolvedPath);
        this.graph = new KnowledgeGraph(this.storage);
        this.memorySearch = new MemorySearch(this.storage, this.graph);
        this.observations = new ObservationStore(this.storage);
        this.sessionRAG = new SessionRAGStore(this.storage);
        this.ragRetriever = new SessionRAGRetriever(this.storage, this.sessionRAG);
        this.reflections = new ReflectionStore(this.storage);
    }
    /**
     * Check if the given path is the core package itself
     */
    isCorePackage(projectPath) {
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            return packageJson.name === '@su-record/vibe';
        }
        catch {
            return false;
        }
    }
    /**
     * Get MemoryManager instance for a specific project
     */
    static getInstance(projectPath) {
        if (projectPath) {
            const normalizedPath = path.resolve(projectPath);
            if (!MemoryManager.instances.has(normalizedPath)) {
                MemoryManager.instances.set(normalizedPath, new MemoryManager(normalizedPath));
            }
            return MemoryManager.instances.get(normalizedPath);
        }
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
    save(key, value, category = 'general', priority = 0) {
        this.storage.save(key, value, category, priority);
    }
    recall(key) {
        return this.storage.recall(key);
    }
    delete(key) {
        return this.storage.delete(key);
    }
    update(key, value) {
        return this.storage.update(key, value);
    }
    list(category) {
        return this.storage.list(category);
    }
    getByPriority(priority) {
        return this.storage.getByPriority(priority);
    }
    setPriority(key, priority) {
        return this.storage.setPriority(key, priority);
    }
    getStats() {
        return this.storage.getStats();
    }
    getTimeline(startDate, endDate, limit = 50) {
        return this.storage.getTimeline(startDate, endDate, limit);
    }
    getDbPath() {
        return this.storage.getDbPath();
    }
    // ============================================================================
    // Knowledge Graph Operations (delegated to KnowledgeGraph)
    // ============================================================================
    linkMemories(sourceKey, targetKey, relationType, strength = 1.0, metadata) {
        return this.graph.linkMemories(sourceKey, targetKey, relationType, strength, metadata);
    }
    getRelations(key, direction = 'both') {
        return this.graph.getRelations(key, direction);
    }
    getRelatedMemories(key, depth = 1, relationType) {
        return this.graph.getRelatedMemories(key, depth, relationType);
    }
    getMemoryGraph(key, depth = 2) {
        return this.graph.getMemoryGraph(key, depth);
    }
    findPath(sourceKey, targetKey) {
        return this.graph.findPath(sourceKey, targetKey);
    }
    unlinkMemories(sourceKey, targetKey, relationType) {
        return this.graph.unlinkMemories(sourceKey, targetKey, relationType);
    }
    // ============================================================================
    // Search Operations (delegated to MemorySearch)
    // ============================================================================
    search(query) {
        return this.storage.search(query);
    }
    searchAdvanced(query, strategy, options = {}) {
        return this.memorySearch.searchAdvanced(query, strategy, options);
    }
    async searchAdvancedAsync(query, strategy, options = {}) {
        return this.memorySearch.searchAdvancedAsync(query, strategy, options);
    }
    // ============================================================================
    // Observation Operations (delegated to ObservationStore)
    // ============================================================================
    addObservation(input) {
        return this.observations.add(input);
    }
    searchObservations(query, limit = 20) {
        return this.observations.search(query, limit);
    }
    getRecentObservations(limit = 10, type) {
        return this.observations.getRecent(limit, type);
    }
    getObservationsBySession(sessionId, limit = 50) {
        return this.observations.getBySession(sessionId, limit);
    }
    getObservationStats() {
        return this.observations.getStats();
    }
    // ============================================================================
    // Session RAG Operations (delegated to SessionRAGStore/Retriever)
    // ============================================================================
    // Decisions
    addDecision(input) {
        return this.sessionRAG.addDecision(input);
    }
    getDecision(id) {
        return this.sessionRAG.getDecision(id);
    }
    updateDecision(id, updates) {
        return this.sessionRAG.updateDecision(id, updates);
    }
    listDecisions(sessionId, status, limit) {
        return this.sessionRAG.listDecisions(sessionId, status, limit);
    }
    searchDecisions(query, limit) {
        return this.sessionRAG.searchDecisions(query, limit);
    }
    // Constraints
    addConstraint(input) {
        return this.sessionRAG.addConstraint(input);
    }
    getConstraint(id) {
        return this.sessionRAG.getConstraint(id);
    }
    updateConstraint(id, updates) {
        return this.sessionRAG.updateConstraint(id, updates);
    }
    listConstraints(sessionId, type, severity, limit) {
        return this.sessionRAG.listConstraints(sessionId, type, severity, limit);
    }
    // Goals
    addGoal(input) {
        return this.sessionRAG.addGoal(input);
    }
    getGoal(id) {
        return this.sessionRAG.getGoal(id);
    }
    updateGoal(id, updates) {
        return this.sessionRAG.updateGoal(id, updates);
    }
    getActiveGoals(limit) {
        return this.sessionRAG.getActiveGoals(limit);
    }
    listGoals(sessionId, status, limit) {
        return this.sessionRAG.listGoals(sessionId, status, limit);
    }
    // Evidence
    addEvidence(input) {
        return this.sessionRAG.addEvidence(input);
    }
    getEvidence(id) {
        return this.sessionRAG.getEvidence(id);
    }
    listEvidence(sessionId, type, status, limit) {
        return this.sessionRAG.listEvidence(sessionId, type, status, limit);
    }
    // Retrieval
    retrieveSessionContext(options) {
        return this.ragRetriever.retrieve(options);
    }
    retrieveActiveContext() {
        return this.ragRetriever.retrieveActiveContext();
    }
    getSessionRAGStats() {
        return this.sessionRAG.getStats();
    }
    // ============================================================================
    // Reflection Operations (delegated to ReflectionStore)
    // ============================================================================
    getReflectionStore() {
        return this.reflections;
    }
    addReflection(input) {
        return this.reflections.save(input);
    }
    searchReflections(query, limit) {
        return this.reflections.search(query, limit);
    }
    getRecentReflections(limit) {
        return this.reflections.getRecent(limit);
    }
    getHighValueReflections(minScore, limit) {
        return this.reflections.getHighValue(minScore, limit);
    }
    getReflectionsBySession(sessionId) {
        return this.reflections.getBySession(sessionId);
    }
    // ============================================================================
    // Lifecycle Management
    // ============================================================================
    close() {
        this.storage.close();
    }
    static resetInstance(projectPath) {
        if (projectPath) {
            const normalizedPath = path.resolve(projectPath);
            const instance = MemoryManager.instances.get(normalizedPath);
            if (instance) {
                instance.close();
                MemoryManager.instances.delete(normalizedPath);
            }
        }
        else {
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
//# sourceMappingURL=MemoryManager.js.map