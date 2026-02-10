// Evolution module re-exports

// Phase 1: Self-Reflection
export { ReflectionStore } from '../memory/ReflectionStore.js';
export type { Reflection, ReflectionInput, ReflectionType, ReflectionTrigger } from '../memory/ReflectionStore.js';

// Phase 2: Insight Extraction
export { InsightStore } from './InsightStore.js';
export type { Insight, InsightInput, InsightType, InsightStatus } from './InsightStore.js';
export { InsightExtractor } from './InsightExtractor.js';
export { SkillGapDetector } from './SkillGapDetector.js';
export { AgentAnalyzer } from './AgentAnalyzer.js';

// Phase 3: Auto Generation
export { GenerationRegistry } from './GenerationRegistry.js';
export type { Generation, GenerationInput, GenerationType, GenerationStatus } from './GenerationRegistry.js';
export { SkillGenerator } from './generators/SkillGenerator.js';
export { AgentGenerator } from './generators/AgentGenerator.js';
export { RuleGenerator } from './generators/RuleGenerator.js';
export { TriggerCollisionDetector } from './TriggerCollisionDetector.js';
export type { CollisionResult } from './TriggerCollisionDetector.js';
export { EvolutionOrchestrator } from './EvolutionOrchestrator.js';
export type { OrchestrationResult } from './EvolutionOrchestrator.js';

// Phase 4: Validation & Lifecycle
export { UsageTracker } from './UsageTracker.js';
export type { UsageEvent, FeedbackType } from './UsageTracker.js';
export { LifecycleManager } from './LifecycleManager.js';
export { RollbackManager } from './RollbackManager.js';
export { CircuitBreaker } from './CircuitBreaker.js';
export type { CircuitState } from './CircuitBreaker.js';
