export { EventBus, type EventListener } from './EventBus.js';
export {
  AuditStore,
  type AuditEventRow,
  type AuditQueryFilters,
  type AuditStats,
  type AuditRecordInput,
} from './AuditStore.js';
export { EventOutbox } from './EventOutbox.js';
export {
  RiskLevel,
  ActionType,
  OutcomeType,
  ConfirmationStatus,
  AgentActionEventSchema,
  PolicyCheckEventSchema,
  RiskAssessedEventSchema,
  ConfirmationEventSchema,
  AuditLogEventSchema,
  ErrorEventSchema,
  EventSchemaMap,
  type AutonomyEventType,
  type EventPayload,
  type EventInput,
  type EnrichedEvent,
  type AgentActionEvent,
  type PolicyCheckEvent,
  type RiskAssessedEvent,
  type ConfirmationEvent,
  type AuditLogEvent,
  type ErrorEvent,
} from './schemas.js';

// Phase 2: Security Sentinel
export {
  RiskClassifier,
  type RiskAssessment,
  type ClassificationContext,
  type CustomRiskRule,
} from './RiskClassifier.js';
export {
  PolicyEngine,
  type PolicyRule,
  type PolicyAction,
  type PolicyDecision,
  type PolicyRow,
} from './PolicyEngine.js';
export {
  SecuritySentinel,
  isSentinelProtectedPath,
  type InterceptResult,
  type SentinelDeps,
} from './SecuritySentinel.js';

// Phase 3: Owner Governance
export {
  ConfirmationStore,
  InvalidTransitionError,
  type ConfirmationRow,
  type CreateConfirmationInput,
} from './ConfirmationStore.js';
export {
  ConfirmationManager,
  type ConfirmationResult,
} from './ConfirmationManager.js';
export {
  NotificationDispatcher,
  type NotificationChannel,
  type NotificationResult,
} from './NotificationDispatcher.js';

// Phase 4: Proactive Intelligence
export {
  SuggestionStore,
  type SuggestionRow,
  type SuggestionType,
  type CreateSuggestionInput,
  type SuggestionStats,
} from './SuggestionStore.js';
export {
  ProactiveAnalyzer,
  SecurityScanner,
  PerformanceDetector,
  QualityChecker,
  DependencyMonitor,
  type AnalysisModule,
  type AnalysisContext,
  type AnalysisTrigger,
  type Suggestion,
} from './ProactiveAnalyzer.js';
export { BackgroundMonitor } from './BackgroundMonitor.js';

// Phase 5: Agent Collaboration
export {
  TaskDecomposer,
  CircularDependencyError,
  type DecomposedTask,
  type TaskStep,
  type StepType,
  type StepStatus,
  type Complexity,
} from './TaskDecomposer.js';
export {
  CollaborationProtocol,
  MessageSizeError,
  AgentTimeoutError,
  type AgentMessage,
  type MessageType,
  type AgentRole,
  type AgentAssignment,
  type HandoffContext,
  type HandoffResult,
} from './CollaborationProtocol.js';
export {
  AutonomyOrchestrator,
  type AutonomyMode,
  type StepResult,
  type ExecutionResult,
  type TaskProgress,
  type StepExecutor,
  type OrchestratorDeps,
} from './AutonomyOrchestrator.js';
export {
  SentinelConfigSchema,
  AutonomyConfigSchema,
  FullConfigSchema,
  AutonomyModeEnum,
  loadConfig,
  getDefaultConfig,
  type SentinelConfig,
  type AutonomyConfig,
  type FullConfig,
} from './AutonomyConfig.js';
