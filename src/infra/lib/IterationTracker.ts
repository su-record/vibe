/**
 * Iteration Tracker for ULTRAWORK/Ralph Loop
 * 작업 진행 상황을 추적하고 표시
 *
 * Also provides disk-based progress persistence (merged from ProgressTracker).
 */

import fs from 'fs';
import path from 'path';
import { LoopBreaker } from './LoopBreaker.js';

// ============================================
// Disk-Persisted Progress Types
// ============================================

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

export function getProgressPath(projectRoot: string): string {
  return path.join(projectRoot, '.claude', 'vibe', 'progress.json');
}

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

export function saveProgress(projectRoot: string, progress: ProgressState): void {
  const progressPath = getProgressPath(projectRoot);
  const coreDir = path.dirname(progressPath);

  if (!fs.existsSync(coreDir)) {
    fs.mkdirSync(coreDir, { recursive: true });
  }

  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

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

      const nextPhase = progress.phases.find(p => p.id === phaseNumber + 1);
      if (nextPhase) {
        nextPhase.status = 'in_progress';
        nextPhase.startedAt = new Date().toISOString();
        progress.currentPhase = nextPhase.id;
      } else {
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

export function recordCommit(projectRoot: string, commitHash: string): ProgressState | null {
  const progress = loadProgress(projectRoot);
  if (!progress) return null;

  progress.lastCommit = commitHash;
  saveProgress(projectRoot, progress);
  return progress;
}

export function incrementSession(projectRoot: string): ProgressState | null {
  const progress = loadProgress(projectRoot);
  if (!progress) return null;

  progress.sessionCount++;
  saveProgress(projectRoot, progress);
  return progress;
}

export function formatProgressState(progress: ProgressState): string {
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
    lines.push(`Blockers:`);
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

export function getProgressSummary(projectRoot: string): string | null {
  const progress = loadProgress(projectRoot);
  if (!progress || progress.status === 'completed') return null;

  const currentPhase = progress.phases.find(p => p.id === progress.currentPhase);
  const phaseName = currentPhase?.name || 'Unknown';

  return `Active feature: "${progress.feature}" - Phase ${progress.currentPhase}/${progress.totalPhases} (${phaseName})`;
}

export function writeProgressText(projectRoot: string): void {
  const progress = loadProgress(projectRoot);
  if (!progress) return;

  const progressTextPath = path.join(projectRoot, '.claude', 'vibe', 'claude-progress.txt');
  const lines: string[] = [];

  lines.push(`# Progress: ${progress.feature}`);
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(`Status: ${progress.status.toUpperCase()}`);
  lines.push(`Session: ${progress.sessionCount}`);
  lines.push('');

  lines.push('## Phases');
  for (const phase of progress.phases) {
    const icon = { pending: '[ ]', in_progress: '[>]', completed: '[x]', blocked: '[!]' }[phase.status];
    lines.push(`${icon} Phase ${phase.id}: ${phase.name}`);
    if (phase.blockers?.length) {
      for (const b of phase.blockers) {
        lines.push(`    BLOCKED: ${b}`);
      }
    }
  }

  if (progress.completedTasks.length > 0) {
    lines.push('');
    lines.push('## Completed');
    for (const task of progress.completedTasks) {
      lines.push(`- ${task}`);
    }
  }

  if (progress.pendingTasks.length > 0) {
    lines.push('');
    lines.push('## Remaining');
    for (const task of progress.pendingTasks) {
      lines.push(`- ${task}`);
    }
  }

  if (progress.blockers.length > 0) {
    lines.push('');
    lines.push('## Blockers');
    for (const blocker of progress.blockers) {
      lines.push(`- ${blocker}`);
    }
  }

  if (progress.lastCommit) {
    lines.push('');
    lines.push(`## Last Commit: ${progress.lastCommit}`);
  }

  const coreDir = path.dirname(progressTextPath);
  if (!fs.existsSync(coreDir)) {
    fs.mkdirSync(coreDir, { recursive: true });
  }
  fs.writeFileSync(progressTextPath, lines.join('\n') + '\n');
}

// ============================================
// In-Memory Iteration State Types
// ============================================

export interface PhaseProgress {
  phaseNumber: number;
  phaseName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'retrying';
  startTime?: Date;
  endTime?: Date;
  retryCount: number;
  error?: string;
}

export interface IterationState {
  featureName: string;
  totalPhases: number;
  currentPhase: number;
  phases: PhaseProgress[];
  isUltrawork: boolean;
  maxRetries: number;
  startTime: Date;
  endTime?: Date;
  /** 파이프라인 모드 활성화 여부 */
  pipelineEnabled?: boolean;
}

// 전역 상태 (세션 내 유지)
let currentState: IterationState | null = null;

// Module-level LoopBreaker instance (lazy init per startIteration call)
let _loopBreaker: LoopBreaker | null = null;

function getLoopBreaker(): LoopBreaker {
  if (!_loopBreaker) {
    _loopBreaker = new LoopBreaker();
  }
  return _loopBreaker;
}

/**
 * 새 작업 시작
 */
export function startIteration(
  featureName: string,
  phaseNames: string[],
  isUltrawork: boolean = false,
  maxRetries: number = 3,
  pipelineEnabled: boolean = false
): IterationState {
  // Reset LoopBreaker for the new iteration
  _loopBreaker = new LoopBreaker();

  currentState = {
    featureName,
    totalPhases: phaseNames.length,
    currentPhase: 0,
    phases: phaseNames.map((name, index) => ({
      phaseNumber: index + 1,
      phaseName: name,
      status: 'pending',
      retryCount: 0,
    })),
    isUltrawork,
    maxRetries,
    startTime: new Date(),
    pipelineEnabled,
  };

  return currentState;
}

/**
 * Phase 시작
 * Records an iteration with LoopBreaker; returns null if the loop limit is hit.
 */
export function startPhase(phaseNumber: number): PhaseProgress | null {
  if (!currentState || phaseNumber < 1 || phaseNumber > currentState.totalPhases) {
    return null;
  }

  const breakResult = getLoopBreaker().recordIteration();
  if (breakResult.shouldBreak) {
    return null;
  }

  const phase = currentState.phases[phaseNumber - 1];
  phase.status = 'in_progress';
  phase.startTime = new Date();
  currentState.currentPhase = phaseNumber;

  return phase;
}

/**
 * Phase 완료
 * Resets the consecutive error counter in LoopBreaker on success.
 */
export function completePhase(phaseNumber: number): PhaseProgress | null {
  if (!currentState || phaseNumber < 1 || phaseNumber > currentState.totalPhases) {
    return null;
  }

  getLoopBreaker().recordSuccess();

  const phase = currentState.phases[phaseNumber - 1];
  phase.status = 'completed';
  phase.endTime = new Date();

  return phase;
}

/**
 * Phase 실패 (재시도 가능)
 * Records an error with LoopBreaker; forces canRetry=false when the error limit is hit.
 */
export function failPhase(phaseNumber: number, error: string): { canRetry: boolean; phase: PhaseProgress } | null {
  if (!currentState || phaseNumber < 1 || phaseNumber > currentState.totalPhases) {
    return null;
  }

  const breakResult = getLoopBreaker().recordError();

  const phase = currentState.phases[phaseNumber - 1];
  phase.retryCount += 1;
  phase.error = error;

  const withinRetries = phase.retryCount < currentState.maxRetries;
  const canRetry = withinRetries && !breakResult.shouldBreak;
  phase.status = canRetry ? 'retrying' : 'failed';

  return { canRetry, phase };
}

/**
 * 전체 작업 완료
 */
export function completeIteration(): IterationState | null {
  if (!currentState) return null;

  currentState.endTime = new Date();
  const state = currentState;
  currentState = null;

  return state;
}

/**
 * 현재 상태 조회
 */
export function getCurrentState(): IterationState | null {
  return currentState;
}

/**
 * Returns the current LoopBreaker instance for external inspection.
 */
export function getIterationLoopBreaker(): LoopBreaker {
  return getLoopBreaker();
}

/**
 * 진행 상황 포맷팅 (터미널 출력용)
 */
export function formatProgress(state: IterationState = currentState!): string {
  if (!state) return '';

  const lines: string[] = [];
  const mode = state.isUltrawork ? '🚀 ULTRAWORK' : '📋 STANDARD';

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`${mode} - ${state.featureName}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  for (const phase of state.phases) {
    const statusIcon = getStatusIcon(phase.status);
    const retryInfo = phase.retryCount > 0 ? ` (retry ${phase.retryCount}/${state.maxRetries})` : '';
    const current = phase.phaseNumber === state.currentPhase ? ' ←' : '';

    lines.push(`${statusIcon} Phase ${phase.phaseNumber}/${state.totalPhases}: ${phase.phaseName}${retryInfo}${current}`);
  }

  const completed = state.phases.filter(p => p.status === 'completed').length;
  const progress = Math.round((completed / state.totalPhases) * 100);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`Progress: ${completed}/${state.totalPhases} (${progress}%)`);

  return lines.join('\n');
}

/**
 * Phase 시작 배너
 */
export function formatPhaseStart(phaseNumber: number, phaseName: string, totalPhases: number): string {
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏔️ BOULDER ROLLING... Phase ${phaseNumber}/${totalPhases}
   ${phaseName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`.trim();
}

/**
 * Phase 완료 배너
 */
export function formatPhaseComplete(phaseNumber: number, totalPhases: number): string {
  return `✅ Phase ${phaseNumber}/${totalPhases} complete`;
}

/**
 * 전체 완료 배너
 */
export function formatIterationComplete(state: IterationState): string {
  const duration = state.endTime
    ? Math.round((state.endTime.getTime() - state.startTime.getTime()) / 1000)
    : 0;

  const totalRetries = state.phases.reduce((sum, p) => sum + p.retryCount, 0);
  const retryInfo = totalRetries > 0 ? ` (${totalRetries} retries)` : '';

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 BOULDER REACHED THE TOP!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Feature: ${state.featureName}
Phases:  ${state.totalPhases}/${state.totalPhases} complete${retryInfo}
Time:    ${duration}s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`.trim();
}

/**
 * 상태 아이콘
 */
function getStatusIcon(status: PhaseProgress['status']): string {
  switch (status) {
    case 'completed': return '✅';
    case 'in_progress': return '🔨';
    case 'pending': return '⬜';
    case 'failed': return '❌';
    case 'retrying': return '🔄';
    default: return '⬜';
  }
}

/**
 * Split SPEC 감지 및 파싱
 */
export function detectSplitSpec(specPath: string): { isSplit: boolean; masterPath?: string; phasePaths?: string[] } {
  // 폴더 구조인 경우 (_index.md + phase-*.md)
  if (specPath.includes('_index.md')) {
    const baseDir = specPath.replace('/_index.md', '').replace('\\_index.md', '');
    return {
      isSplit: true,
      masterPath: specPath,
      phasePaths: [], // 실제 사용 시 glob으로 phase-*.md 찾기
    };
  }

  // 단일 파일
  return { isSplit: false };
}

/**
 * SPEC에서 Phase 이름 추출
 */
export function extractPhaseNames(specContent: string): string[] {
  const phaseRegex = /###\s*Phase\s*\d+[:\s]*([^\n]+)/gi;
  const names: string[] = [];
  let match;

  while ((match = phaseRegex.exec(specContent)) !== null) {
    names.push(match[1].trim());
  }

  // Phase 이름이 없으면 번호만 사용
  if (names.length === 0) {
    const phaseCount = (specContent.match(/###\s*Phase\s*\d+/gi) || []).length;
    for (let i = 1; i <= phaseCount; i++) {
      names.push(`Phase ${i}`);
    }
  }

  return names;
}
