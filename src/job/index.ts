/**
 * Job Module Exports
 * Phase 2: Job/Order System + Phase 4: Async Job System
 */

// Phase 2: Job/Order System
export { JobStore } from './JobStore.js';
export { JobManager } from './JobManager.js';
export { JobQueue } from './JobQueue.js';
export { IntentParser } from './IntentParser.js';
export { ActionPlanGenerator } from './ActionPlanGenerator.js';

export type {
  Job,
  JobCreateInput,
  JobStatus,
  JobLog,
  ActionPlan,
  ActionStep,
  ParsedIntent,
  IntentType,
  RiskLevel,
  JobQueueConfig,
} from './types.js';

export {
  VALID_TRANSITIONS,
  DEFAULT_QUEUE_CONFIG,
  isValidTransition,
  generateJobId,
  nowISO,
} from './types.js';

// Phase 4: Async Job System (from agent/jobs/)
export { JobManager as AgentJobManager } from './AgentJobManager.js';
export { ProgressReporter } from './ProgressReporter.js';
export type { AgentJob, JobProgress, JobRow } from './agent-job-types.js';
