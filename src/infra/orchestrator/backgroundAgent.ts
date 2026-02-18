/**
 * Background Agent - 백그라운드 에이전트 관리 (re-export)
 */

// SessionStore
export {
  sessionStore,
  listActiveSessions,
  getSessionHistory
} from './SessionStore.js';
export type { SessionData } from './SessionStore.js';

// AgentExecutor
export {
  launchBackgroundAgent,
  getBackgroundAgentResult,
  cancelBackgroundAgent,
  launchParallelAgents
} from './AgentExecutor.js';

// BackgroundManager
export {
  backgroundManager,
  launch,
  poll,
  cancel,
  getStats,
  QueueOverflowError,
  TaskTimeoutError,
  PipelineTimeoutError,
  AgentExecutionError
} from './BackgroundManager.js';
export type { TaskStatus, TaskInfo, QueueStats } from './BackgroundManager.js';
