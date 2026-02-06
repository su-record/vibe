/**
 * Daemon Type Definitions
 * Phase 1: Agent Engine (상주 데몬)
 */

// ============================================================================
// JSON-RPC 2.0 Types
// ============================================================================

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
  id: string | number;
  auth?: string;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: JsonRpcError;
  id: string | number | null;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** Standard JSON-RPC error codes + custom codes */
export const RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  TIMEOUT: -1001,
  AUTH_FAILED: -1002,
} as const;

export type RpcErrorCode = typeof RPC_ERROR_CODES[keyof typeof RPC_ERROR_CODES];

// ============================================================================
// Daemon Types
// ============================================================================

export interface DaemonConfig {
  socketPath: string;
  pidFile: string;
  tokenFile: string;
  logDir: string;
  logFile: string;
  maxPayloadBytes: number;
  ipcTimeoutMs: number;
  gracefulShutdownMs: number;
  maxGlobalSessions: number;
  maxSessionsPerProject: number;
  idleSessionTimeoutMs: number;
  sessionReconnectMaxRetries: number;
}

export interface DaemonHealth {
  status: 'running' | 'stopping';
  uptime: number;
  memory: NodeJS.MemoryUsage;
  activeSessions: number;
  version: string;
  pid: number;
}

export interface DaemonStatus {
  running: boolean;
  pid?: number;
  uptime?: number;
  activeSessions?: number;
  memoryUsage?: number;
  version?: string;
}

// ============================================================================
// Session Types
// ============================================================================

export interface SessionInfo {
  id: string;
  projectPath: string;
  createdAt: number;
  lastUsedAt: number;
  status: 'idle' | 'busy' | 'error';
  envSnapshot?: Record<string, string>;
}

export interface SessionRequest {
  projectPath: string;
  message: string;
  sessionId?: string;
}

export interface SessionResponse {
  sessionId: string;
  result: string;
  success: boolean;
  error?: string;
}

// ============================================================================
// RPC Method Handler
// ============================================================================

export type RpcMethodHandler = (
  params: Record<string, unknown> | undefined
) => Promise<unknown> | unknown;

export interface RpcMethodRegistry {
  [method: string]: RpcMethodHandler;
}

// ============================================================================
// Daemon Events
// ============================================================================

export type DaemonEvent =
  | { type: 'started'; pid: number }
  | { type: 'stopping' }
  | { type: 'stopped' }
  | { type: 'error'; error: Error }
  | { type: 'session_created'; sessionId: string; projectPath: string }
  | { type: 'session_closed'; sessionId: string }
  | { type: 'client_connected' }
  | { type: 'client_disconnected' };

export type DaemonEventListener = (event: DaemonEvent) => void;

// ============================================================================
// Log Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}
