// Memory module exports
// Provides both modular components and legacy MemoryManager facade

export { MemoryStorage, MemoryItem } from './MemoryStorage.js';
export type { IMemoryStorage } from './IMemoryStorage.js';
export { InMemoryStorage } from './InMemoryStorage.js';
export { KnowledgeGraph } from './KnowledgeGraph.js';
export { MemorySearch, SearchStrategy, SearchOptions } from './MemorySearch.js';
export { ObservationStore, Observation, ObservationInput, ObservationType } from './ObservationStore.js';

// Session RAG
export { SessionRAGStore } from './SessionRAGStore.js';
export { SessionRAGRetriever } from './SessionRAGRetriever.js';
export { SessionSummarizer } from './SessionSummarizer.js';

// Session RAG Types
export type {
  Decision,
  DecisionInput,
  DecisionStatus,
  Constraint,
  ConstraintInput,
  ConstraintType,
  ConstraintSeverity,
  Goal,
  GoalInput,
  GoalStatus,
  Evidence,
  EvidenceInput,
  EvidenceType,
  EvidenceStatus,
  SessionRAGStats,
} from './SessionRAGStore.js';

export type {
  RetrievalOptions,
  SessionRAGResult,
} from './SessionRAGRetriever.js';

export type {
  SessionSummary,
} from './SessionSummarizer.js';

// TaskContext
export { TaskContext } from '../TaskContext.js';
export type {
  ContextScope,
  TaskContextData,
  TaskContextCreateOptions,
  TaskContextForkOptions,
  ScopeFilter,
} from '../TaskContext.js';

// TokenBudgetTracker
export { TokenBudgetTracker } from '../TokenBudgetTracker.js';
export type {
  TokenSource,
  ThresholdLevel,
  BudgetSnapshot,
  ActionEstimate,
} from '../TokenBudgetTracker.js';

// Re-export MemoryManager facade from parent for backward compatibility
// Note: MemoryManager is in parent directory, import it from there
