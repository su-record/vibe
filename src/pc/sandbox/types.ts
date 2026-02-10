/**
 * Docker Sandbox Types — Phase 5
 *
 * Container management, security config, tool policy, exec allowlist.
 */

// ============================================================================
// Container Types
// ============================================================================

export type SandboxScope = 'session' | 'user' | 'shared';

export type ContainerState = 'creating' | 'running' | 'stopped' | 'removing' | 'error';

export interface ContainerInfo {
  containerId: string;
  userId: string;
  scope: SandboxScope;
  state: ContainerState;
  createdAt: string;
  lastActivityAt: string;
  cpuLimit: number;
  memoryLimitMb: number;
  pidLimit: number;
  labels: Record<string, string>;
}

export interface ContainerCreateOptions {
  scope: SandboxScope;
  image?: string;
  cpuLimit?: number;
  memoryLimitMb?: number;
  pidLimit?: number;
  networkMode?: string;
  labels?: Record<string, string>;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

// ============================================================================
// Container Config Constants
// ============================================================================

export const DEFAULT_CONTAINER_CONFIG = {
  image: 'node:22-slim',
  cpuLimit: 0.5,
  memoryLimitMb: 512,
  pidLimit: 100,
  execTimeoutMs: 30_000,
  inactivityTimeoutMs: 30 * 60 * 1000,
  maxContainersTotal: 50,
  maxContainersPerUser: 2,
  warmPoolSize: 3,
  createRetries: 2,
} as const;

// ============================================================================
// Security Config
// ============================================================================

export interface SeccompProfile {
  defaultAction: string;
  syscalls: Array<{
    names: string[];
    action: string;
  }>;
}

export interface SecurityConfig {
  readonlyRootfs: boolean;
  noNewPrivileges: boolean;
  dropCapabilities: string[];
  addCapabilities: string[];
  seccompProfile: SeccompProfile;
  tmpfsMounts: Array<{ destination: string; size: string }>;
  userNamespaceRemap: boolean;
  deviceAccess: boolean;
}

// ============================================================================
// Tool Policy Types
// ============================================================================

export type PolicyLevel = 'profile' | 'global' | 'user' | 'channel' | 'sandbox' | 'subagent';

export type PolicyAction = 'allow' | 'deny' | 'ask';

export interface PolicyRule {
  pattern: string;
  action: PolicyAction;
  reason?: string;
}

export interface PolicyLayer {
  level: PolicyLevel;
  rules: PolicyRule[];
}

export interface PolicyEvalResult {
  allowed: boolean;
  action: PolicyAction;
  matchedLevel: PolicyLevel;
  matchedPattern: string;
  reason?: string;
}

// ============================================================================
// Exec Allowlist Types
// ============================================================================

export interface AllowlistEntry {
  pattern: string;
  description?: string;
  addedAt: string;
  addedBy: 'default' | 'user' | 'auto';
}

export type ApprovalStatus = 'pending' | 'approved' | 'denied';

export interface ApprovalRequest {
  requestId: string;
  command: string;
  userId: string;
  status: ApprovalStatus;
  createdAt: string;
  respondedAt?: string;
  alwaysAllow: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export type SandboxErrorCode =
  | 'DOCKER_NOT_RUNNING'
  | 'CONTAINER_CREATE_FAILED'
  | 'CONTAINER_NOT_FOUND'
  | 'EXEC_FAILED'
  | 'EXEC_TIMEOUT'
  | 'EXEC_DENIED'
  | 'POLICY_DENIED'
  | 'MAX_CONTAINERS_REACHED'
  | 'IMAGE_NOT_FOUND';

export interface SandboxError extends Error {
  code: SandboxErrorCode;
}

export function createSandboxError(code: SandboxErrorCode, message: string): SandboxError {
  const error = new Error(message) as SandboxError;
  error.code = code;
  return error;
}

// ============================================================================
// Logger
// ============================================================================

export type SandboxLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type SandboxLogger = (level: SandboxLogLevel, message: string, data?: unknown) => void;
