/**
 * ProgressTracker - Structured progress tracking for long-running features
 * Inspired by Anthropic's "Effective Harnesses for Long-Running Agents"
 */

import fs from 'fs';
import path from 'path';

export interface PhaseInfo {
  id: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  startedAt?: string;
  completedAt?: string;
  blockers?: string[];
}

export interface ProgressState {
  feature: string;
  spec: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed';
  currentPhase: number;
  totalPhases: number;
  phases: PhaseInfo[];
  completedTasks: string[];
  pendingTasks: string[];
  blockers: string[];
  lastCommit?: string;
  lastUpdated: string;
  startedAt: string;
  sessionCount: number;
}

const DEFAULT_PROGRESS: ProgressState = {
  feature: '',
  spec: '',
  status: 'pending',
  currentPhase: 0,
  totalPhases: 0,
  phases: [],
  completedTasks: [],
  pendingTasks: [],
  blockers: [],
  lastUpdated: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  sessionCount: 0,
};

/**
 * Get progress file path for a project
 */
export function getProgressPath(projectRoot: string): string {
  return path.join(projectRoot, '.claude', 'vibe', 'progress.json');
}

/**
 * Load progress state from file
 */
export function loadProgress(projectRoot: string): ProgressState | null {
  const progressPath = getProgressPath(projectRoot);
  try {
    if (fs.existsSync(progressPath)) {
      const content = fs.readFileSync(progressPath, 'utf-8');
      return JSON.parse(content) as ProgressState;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Save progress state to file
 */
export function saveProgress(projectRoot: string, progress: ProgressState): void {
  const progressPath = getProgressPath(projectRoot);
  const vibeDir = path.dirname(progressPath);

  if (!fs.existsSync(vibeDir)) {
    fs.mkdirSync(vibeDir, { recursive: true });
  }

  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

/**
 * Initialize progress for a new feature
 */
export function initProgress(
  projectRoot: string,
  feature: string,
  spec: string,
  phases: string[]
): ProgressState {
  const progress: ProgressState = {
    ...DEFAULT_PROGRESS,
    feature,
    spec,
    status: 'in_progress',
    currentPhase: 1,
    totalPhases: phases.length,
    phases: phases.map((name, idx) => ({
      id: idx + 1,
      name,
      status: idx === 0 ? 'in_progress' : 'pending',
      startedAt: idx === 0 ? new Date().toISOString() : undefined,
    })),
    pendingTasks: phases.slice(1),
    startedAt: new Date().toISOString(),
    sessionCount: 1,
  };

  saveProgress(projectRoot, progress);
  return progress;
}

/**
 * Update phase progress
 */
export function updatePhase(
  projectRoot: string,
  phaseNumber: number,
  status: PhaseInfo['status'],
  blockers?: string[]
): ProgressState | null {
  const progress = loadProgress(projectRoot);
  if (!progress) return null;

  const phase = progress.phases.find(p => p.id === phaseNumber);
  if (phase) {
    phase.status = status;
    if (status === 'in_progress') {
      phase.startedAt = new Date().toISOString();
      progress.currentPhase = phaseNumber;
    } else if (status === 'completed') {
      phase.completedAt = new Date().toISOString();
      progress.completedTasks.push(phase.name);
      progress.pendingTasks = progress.pendingTasks.filter(t => t !== phase.name);

      // Auto-advance to next phase
      const nextPhase = progress.phases.find(p => p.id === phaseNumber + 1);
      if (nextPhase) {
        nextPhase.status = 'in_progress';
        nextPhase.startedAt = new Date().toISOString();
        progress.currentPhase = nextPhase.id;
      } else {
        // All phases completed
        progress.status = 'completed';
      }
    } else if (status === 'blocked') {
      phase.blockers = blockers;
      progress.blockers = blockers || [];
      progress.status = 'blocked';
    }
  }

  saveProgress(projectRoot, progress);
  return progress;
}

/**
 * Add a task to completed list
 */
export function completeTask(projectRoot: string, task: string): ProgressState | null {
  const progress = loadProgress(projectRoot);
  if (!progress) return null;

  if (!progress.completedTasks.includes(task)) {
    progress.completedTasks.push(task);
  }
  progress.pendingTasks = progress.pendingTasks.filter(t => t !== task);

  saveProgress(projectRoot, progress);
  return progress;
}

/**
 * Record last git commit
 */
export function recordCommit(projectRoot: string, commitHash: string): ProgressState | null {
  const progress = loadProgress(projectRoot);
  if (!progress) return null;

  progress.lastCommit = commitHash;
  saveProgress(projectRoot, progress);
  return progress;
}

/**
 * Increment session count (called on session restore)
 */
export function incrementSession(projectRoot: string): ProgressState | null {
  const progress = loadProgress(projectRoot);
  if (!progress) return null;

  progress.sessionCount++;
  saveProgress(projectRoot, progress);
  return progress;
}

/**
 * Format progress for display
 */
export function formatProgress(progress: ProgressState): string {
  const lines: string[] = [];

  const statusIcon = {
    pending: '⏳',
    in_progress: '🔨',
    blocked: '🚫',
    completed: '✅',
  }[progress.status];

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`${statusIcon} Feature: ${progress.feature}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`Status: ${progress.status.toUpperCase()}`);
  lines.push(`Phase: ${progress.currentPhase}/${progress.totalPhases}`);
  lines.push(`Sessions: ${progress.sessionCount}`);
  lines.push(``);

  lines.push(`Phases:`);
  for (const phase of progress.phases) {
    const icon = {
      pending: '○',
      in_progress: '●',
      completed: '✓',
      blocked: '✗',
    }[phase.status];
    lines.push(`  ${icon} ${phase.id}. ${phase.name}`);
  }

  if (progress.completedTasks.length > 0) {
    lines.push(``);
    lines.push(`Completed: ${progress.completedTasks.length} tasks`);
  }

  if (progress.blockers.length > 0) {
    lines.push(``);
    lines.push(`⚠️ Blockers:`);
    for (const blocker of progress.blockers) {
      lines.push(`  - ${blocker}`);
    }
  }

  if (progress.lastCommit) {
    lines.push(``);
    lines.push(`Last commit: ${progress.lastCommit}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return lines.join('\n');
}

/**
 * Get progress summary for session startup
 */
export function getProgressSummary(projectRoot: string): string | null {
  const progress = loadProgress(projectRoot);
  if (!progress || progress.status === 'completed') return null;

  const currentPhase = progress.phases.find(p => p.id === progress.currentPhase);
  const phaseName = currentPhase?.name || 'Unknown';

  return `📋 Active feature: "${progress.feature}" - Phase ${progress.currentPhase}/${progress.totalPhases} (${phaseName})`;
}
