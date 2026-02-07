/**
 * Router Module Exports
 * Runtime Infrastructure: Routing, Intent Classification, Task Planning, Browser Automation
 */

// Core Router
export { ModelARouter } from './ModelARouter.js';
export { IntentClassifier } from './IntentClassifier.js';
export { RouteRegistry } from './RouteRegistry.js';

// Base Route
export { BaseRoute } from './routes/BaseRoute.js';

// Task Planning
export { TaskPlanner } from './planner/TaskPlanner.js';
export { TaskExecutor } from './planner/TaskExecutor.js';

// Browser Automation
export { BrowserManager } from './browser/BrowserManager.js';
export { BrowserAgent } from './browser/BrowserAgent.js';
export { BrowserPool } from './browser/BrowserPool.js';

// Sessions
export { DevSessionManager } from './sessions/DevSessionManager.js';

// Resolvers
export { RepoResolver } from './resolvers/RepoResolver.js';

// Notifications
export { NotificationManager } from './notifications/NotificationManager.js';

// Handlers
export { GitOpsHandler } from './handlers/GitOpsHandler.js';

// QA Bridge
export { TelegramQABridge } from './qa/TelegramQABridge.js';

// Type Definitions
export type {
  IntentCategory,
  ClassifiedIntent,
  RouteContext,
  RouteResult,
  RouteJob,
  RouteJobStatus,
  RouterConfig,
  RepoConfig,
  QAConfig,
  NotificationConfig,
  RouteServices,
  TelegramSendOptions,
  InlineKeyboardButton,
  ModelARouterInterface,
  SmartRouterLike,
  DedupEntry,
} from './types.js';

export { DEFAULT_ROUTER_CONFIG } from './types.js';
