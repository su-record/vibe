/**
 * Async Job System Types
 * Phase 4: Async Job System
 */

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobProgress {
  phase: number;
  totalPhases: number;
  message: string;
  percent: number;
}

export interface AgentJob {
  id: string;
  chatId: string;
  task: string;
  status: JobStatus;
  progress: JobProgress | null;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface JobRow {
  id: string;
  chatId: string;
  task: string;
  status: string;
  progress: string | null;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
}
