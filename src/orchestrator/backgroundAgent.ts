/**
 * Background Agent - 백그라운드 에이전트 관리
 *
 * v2.6.0: 기능이 2개 모듈로 분리됨
 * - SessionStore: 세션 저장소, 정리, 히스토리 관리
 * - AgentExecutor: 에이전트 실행 로직
 *
 * 이 파일은 하위 호환성을 위해 모든 함수를 re-export
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

// BackgroundManager (v2.6.0)
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
