/**
 * CLI Commands: vibe job <subcommand>
 * Phase 2: Job/Order System
 *
 * Commands:
 * - vibe job list               - List all jobs
 * - vibe job status <job-id>    - Show job details
 * - vibe job cancel <job-id>    - Cancel a job
 */

import * as path from 'node:path';
import * as os from 'node:os';
import { JobStore } from '../../job/JobStore.js';
import { Job, JobLog } from '../../job/types.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const DB_PATH = path.join(VIBE_DIR, 'jobs.db');

function getStore(): JobStore | null {
  try {
    return new JobStore(DB_PATH);
  } catch {
    console.error('❌ Failed to open job database');
    return null;
  }
}

export function jobList(): void {
  const store = getStore();
  if (!store) return;

  try {
    const isAll = process.argv.includes('--all');
    const jobs = store.listJobs({ limit: isAll ? 100 : 20 });

    if (jobs.length === 0) {
      console.log('ℹ️  No jobs found');
      return;
    }

    console.log(`
📋 Jobs (${jobs.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    for (const job of jobs) {
      const statusIcon = getStatusIcon(job.status);
      const age = formatAge(job.createdAt);
      const intent = job.intent.length > 50 ? job.intent.slice(0, 47) + '...' : job.intent;
      console.log(`  ${statusIcon} ${job.id.slice(0, 8)} │ ${job.status.padEnd(18)} │ ${age.padEnd(8)} │ ${intent}`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } finally {
    store.close();
  }
}

export async function jobStatus(jobId: string): Promise<void> {
  if (!jobId) {
    console.log('Usage: vibe job status <job-id>');
    return;
  }

  const store = getStore();
  if (!store) return;

  try {
    const job = store.getJob(jobId);
    if (!job) {
      // Try partial match
      const jobs = store.listJobs({ limit: 100 });
      const match = jobs.find((j) => j.id.startsWith(jobId));
      if (match) {
        printJobDetails(store, match);
      } else {
        console.log(`❌ Job not found: ${jobId}`);
      }
      return;
    }

    printJobDetails(store, job);
  } finally {
    store.close();
  }
}

export function jobCancel(jobId: string): void {
  if (!jobId) {
    console.log('Usage: vibe job cancel <job-id>');
    return;
  }

  const store = getStore();
  if (!store) return;

  try {
    const job = store.getJob(jobId);
    if (!job) {
      console.log(`❌ Job not found: ${jobId}`);
      return;
    }

    if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'rejected') {
      console.log(`ℹ️  Job is already ${job.status}`);
      return;
    }

    store.updateJobStatus(jobId, 'cancelled', 'Cancelled via CLI');
    console.log(`✅ Job ${jobId.slice(0, 8)} cancelled`);
  } finally {
    store.close();
  }
}

export function jobHelp(): void {
  console.log(`
Vibe Job Commands:
  vibe job list              List recent jobs
  vibe job list --all        List all jobs
  vibe job status <id>       Show job details
  vibe job cancel <id>       Cancel a job
  vibe job help              Show this help
  `);
}

// ========================================================================
// Helpers
// ========================================================================

function printJobDetails(store: JobStore, job: Job): void {
  const statusIcon = getStatusIcon(job.status);

  console.log(`
${statusIcon} Job: ${job.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Status:    ${job.status}
  Intent:    ${job.intent}
  Project:   ${job.projectPath}
  Priority:  ${job.priority}
  Retries:   ${job.retryCount}/${job.maxRetries}
  Created:   ${job.createdAt}
  Updated:   ${job.updatedAt}${job.startedAt ? `\n  Started:   ${job.startedAt}` : ''}${job.completedAt ? `\n  Completed: ${job.completedAt}` : ''}${job.error ? `\n  Error:     ${job.error}` : ''}${job.result ? `\n  Result:    ${job.result.slice(0, 200)}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim());

  // Show logs
  const logs = store.getLogs(job.id);
  if (logs.length > 0) {
    console.log('\n📝 State History:');
    for (const log of logs) {
      const msg = log.message ? ` (${log.message})` : '';
      console.log(`  ${log.timestamp} │ ${log.fromStatus} → ${log.toStatus}${msg}`);
    }
  }
}

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    pending: '⏳',
    parsing: '🔍',
    planning: '📋',
    evaluating: '⚖️',
    awaiting_approval: '🔔',
    approved: '✅',
    rejected: '❌',
    executing: '🔨',
    completed: '🎉',
    failed: '💥',
    cancelled: '🚫',
  };
  return icons[status] || '❓';
}

function formatAge(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
