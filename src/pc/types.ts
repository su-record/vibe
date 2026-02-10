/**
 * Integration Types — Phase 6
 *
 * Unified Command Layer types for cross-module integration.
 */

// ============================================================================
// Module Types
// ============================================================================

export type ModuleName = 'browser' | 'google' | 'voice' | 'vision' | 'sandbox';

export type ModuleState = 'disabled' | 'initializing' | 'enabled' | 'error';

export interface ModuleInfo {
  name: ModuleName;
  state: ModuleState;
  healthFailCount: number;
  lastHealthCheck: string | null;
  errorMessage?: string;
}

export interface ModuleHandlers {
  init: () => Promise<void>;
  shutdown: () => Promise<void>;
  healthCheck: () => Promise<boolean>;
}

// ============================================================================
// Command Types
// ============================================================================

export type IntentCategory = ModuleName | 'general';

export interface ClassifiedIntent {
  category: IntentCategory;
  confidence: number;
  subcommand?: string;
  params?: Record<string, unknown>;
}

export interface CommandStep {
  module: IntentCategory;
  action: string;
  params: Record<string, unknown>;
  dependsOnPrevious: boolean;
}

export interface CommandResult {
  success: boolean;
  module: IntentCategory;
  data?: unknown;
  error?: string;
  durationMs: number;
}

export interface CompoundResult {
  steps: CommandResult[];
  totalDurationMs: number;
  partialSuccess: boolean;
}

// ============================================================================
// Session Context Types
// ============================================================================

export interface ContextEntry {
  module: IntentCategory;
  action: string;
  summary: string;
  timestamp: string;
  data?: unknown;
}

export interface UserSession {
  userId: string;
  channel: string;
  history: ContextEntry[];
  lastActivityAt: string;
  createdAt: string;
}

// ============================================================================
// Result Formatting Types
// ============================================================================

export type OutputChannel = 'telegram' | 'slack' | 'voice' | 'web';

export interface FormattedResult {
  channel: OutputChannel;
  text: string;
  markdown?: string;
  blocks?: unknown[];
  imageBase64?: string;
  ttsText?: string;
}

// ============================================================================
// Security Types
// ============================================================================

export interface AuditEntry {
  id?: number;
  userId: string;
  channel: string;
  command: string;
  module: string;
  result: 'success' | 'denied' | 'error' | 'rate_limited';
  durationMs: number;
  timestamp: string;
}

export interface RateLimitState {
  userId: string;
  timestamps: number[];
}

// ============================================================================
// Logger
// ============================================================================

export type IntegrationLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type IntegrationLogger = (level: IntegrationLogLevel, message: string, data?: unknown) => void;
