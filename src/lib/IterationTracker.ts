/**
 * Iteration Tracker for ULTRAWORK/Ralph Loop
 * 작업 진행 상황을 추적하고 표시
 */

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
}

// 전역 상태 (세션 내 유지)
let currentState: IterationState | null = null;

/**
 * 새 작업 시작
 */
export function startIteration(
  featureName: string,
  phaseNames: string[],
  isUltrawork: boolean = false,
  maxRetries: number = 3
): IterationState {
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
  };

  return currentState;
}

/**
 * Phase 시작
 */
export function startPhase(phaseNumber: number): PhaseProgress | null {
  if (!currentState || phaseNumber < 1 || phaseNumber > currentState.totalPhases) {
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
 */
export function completePhase(phaseNumber: number): PhaseProgress | null {
  if (!currentState || phaseNumber < 1 || phaseNumber > currentState.totalPhases) {
    return null;
  }

  const phase = currentState.phases[phaseNumber - 1];
  phase.status = 'completed';
  phase.endTime = new Date();

  return phase;
}

/**
 * Phase 실패 (재시도 가능)
 */
export function failPhase(phaseNumber: number, error: string): { canRetry: boolean; phase: PhaseProgress } | null {
  if (!currentState || phaseNumber < 1 || phaseNumber > currentState.totalPhases) {
    return null;
  }

  const phase = currentState.phases[phaseNumber - 1];
  phase.retryCount += 1;
  phase.error = error;

  const canRetry = phase.retryCount < currentState.maxRetries;
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
