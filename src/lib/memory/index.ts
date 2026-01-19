// Memory module exports
// Provides both modular components and legacy MemoryManager facade

export { MemoryStorage, MemoryItem } from './MemoryStorage.js';
export { KnowledgeGraph } from './KnowledgeGraph.js';
export { MemorySearch, SearchStrategy, SearchOptions } from './MemorySearch.js';

// Re-export MemoryManager facade from parent for backward compatibility
// Note: MemoryManager is in parent directory, import it from there
