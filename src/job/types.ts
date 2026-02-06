/**
 * Job/Order System Type Definitions
 * Phase 2: Job/Order 시스템
 */

import * as crypto from 'node:crypto';

// ============================================================================
// Job Status & State Machine
// ============================================================================

export type JobStatus =
  | 'pending'
  | 'parsing'
  | 'planning'
  | 'evaluating'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Valid state transitions */
export const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  pending: ['parsing'],
  parsing: ['planning'],
  planning: ['evaluating'],
  evaluating: ['approved', 'rejected', 'awaiting_approval'],
  awaiting_approval: ['approved', 'rejected'],
  approved: ['executing'],
  rejected: [],
  executing: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: ['pending'], // for retry
  cancelled: [],
};

// ============================================================================
// Job Interfaces
// ============================================================================

export interface Job {
  id: string;
  status: JobStatus;
  intent: string;
  projectPath: string;
  priority: number; // 1=highest, 10=lowest, default 5
  retryCount: number;
  maxRetries: number;
  createdAt: string; // ISO-8601 UTC
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  nextRunAt?: string;
  actionPlanId?: string;
  result?: string;
  error?: string;
  source?: string; // 'cli' | 'telegram' | 'web' | 'webhook'
  metadata?: Record<string, unknown>;
}

export interface JobCreateInput {
  intent: string;
  projectPath: string;
  priority?: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Intent & ActionPlan
// ============================================================================

export type IntentType =
  | 'code'
  | 'analyze'
  | 'review'
  | 'test'
  | 'deploy'
  | 'fix'
  | 'refactor'
  | 'docs'
  | 'general';

export interface ParsedIntent {
  type: IntentType;
  rawText: string;
  summary: string;
  projectPath: string;
  targets: string[]; // files or directories
  confidence: number; // 0-1
}

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface ActionStep {
  id: string;
  type: string; // 'analyze_codebase' | 'create_spec' | 'implement' | 'test' | etc.
  target: string;
  description: string;
  riskLevel: RiskLevel;
  estimatedDurationMs?: number;
}

export interface ActionPlan {
  id: string;
  jobId: string;
  intent: ParsedIntent;
  actions: ActionStep[];
  riskLevel: RiskLevel;
  confidence: number;
  estimatedFiles: number;
  createdAt: string;
}

// ============================================================================
// Job Log
// ============================================================================

export interface JobLog {
  id?: number;
  jobId: string;
  fromStatus: JobStatus;
  toStatus: JobStatus;
  message?: string;
  timestamp: string;
}

// ============================================================================
// Job Queue
// ============================================================================

export interface JobQueueConfig {
  maxConcurrency: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  retryJitterPercent: number;
  actionTimeoutMs: number;
  jobTimeoutMs: number;
}

export const DEFAULT_QUEUE_CONFIG: JobQueueConfig = {
  maxConcurrency: 3,
  maxRetries: 3,
  retryBaseDelayMs: 30000, // 30s
  retryJitterPercent: 20,
  actionTimeoutMs: 10 * 60 * 1000, // 10 min
  jobTimeoutMs: 60 * 60 * 1000, // 60 min
};

// ============================================================================
// Helpers
// ============================================================================

export function generateJobId(): string {
  return crypto.randomUUID();
}

export function isValidTransition(from: JobStatus, to: JobStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nowISO(): string {
  return new Date().toISOString();
}
