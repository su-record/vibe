/**
 * Daemon Module Exports
 * Phase 1: Agent Engine
 */

export { VibeDaemon } from './VibeDaemon.js';
export { DaemonIPC } from './DaemonIPC.js';
export { SessionPool } from './SessionPool.js';

export type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  RpcMethodHandler,
  RpcMethodRegistry,
  DaemonConfig,
  DaemonHealth,
  DaemonStatus,
  DaemonEvent,
  DaemonEventListener,
  SessionInfo,
  SessionRequest,
  SessionResponse,
  LogLevel,
  LogEntry,
} from './types.js';

export { RPC_ERROR_CODES } from './types.js';
