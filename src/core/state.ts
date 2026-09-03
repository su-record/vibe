import { invalidTransition } from './errors.js';
import { vibePath } from './paths.js';
import { nowIso, readJson, writeJson } from './store.js';

export type State = 'NONE' | 'DRAFT' | 'APPROVED' | 'RUNNING' | 'DONE' | 'STUCK' | 'ABANDONED';
export type Stage = 'discover' | 'scope' | 'build' | 'prove' | 'handoff';

export interface StateFile {
  state: State;
  intentHash: string | null;
  approvedAt: string | null;
  runs: number;
  failStreak: number;
  lastFailHash: string | null;
  doneAt: string | null;
  /** DONE 시점의 작업 트리 해시 — 달라지면 DONE 은 무효 */
  doneTree: string | null;
  abandonedReason: string | null;
  updatedAt: string;
}

/** 허용 전이 — 여기 없는 전이는 종료 4. 모델이 원하는 상태를 말해도 소용없다. */
export const TRANSITIONS: Record<State, ReadonlyArray<State>> = {
  NONE: ['DRAFT'],
  DRAFT: ['DRAFT', 'APPROVED', 'ABANDONED'],
  APPROVED: ['RUNNING', 'DRAFT', 'ABANDONED'],
  RUNNING: ['RUNNING', 'DONE', 'STUCK', 'DRAFT', 'ABANDONED'],
  STUCK: ['RUNNING', 'DRAFT', 'ABANDONED'],
  DONE: ['RUNNING', 'DRAFT', 'ABANDONED'],
  ABANDONED: ['DRAFT'],
};

export function emptyState(): StateFile {
  return {
    state: 'NONE',
    intentHash: null,
    approvedAt: null,
    runs: 0,
    failStreak: 0,
    lastFailHash: null,
    doneAt: null,
    doneTree: null,
    abandonedReason: null,
    updatedAt: nowIso(),
  };
}

export function statePath(root: string): string {
  return vibePath(root, 'state.json');
}

export function readState(root: string): StateFile {
  return readJson<StateFile>(statePath(root)) ?? emptyState();
}

export function writeState(root: string, next: StateFile): StateFile {
  const stamped = { ...next, updatedAt: nowIso() };
  writeJson(statePath(root), stamped);
  return stamped;
}

export function canTransition(from: State, to: State): boolean {
  return TRANSITIONS[from].includes(to);
}

/** 전이 표를 지키는 유일한 쓰기 경로. */
export function transition(root: string, to: State, patch: Partial<StateFile> = {}): StateFile {
  const current = readState(root);
  if (!canTransition(current.state, to)) {
    throw invalidTransition(`cannot go ${current.state} → ${to}`);
  }
  return writeState(root, { ...current, ...patch, state: to });
}

/** 단계는 상태에서 파생된다 — 저장하지 않는다. */
export function stageOf(state: StateFile, hasIntent: boolean, allPassedOnce: boolean): Stage {
  switch (state.state) {
    case 'NONE':
      return 'discover';
    case 'DRAFT':
      return hasIntent ? 'scope' : 'discover';
    case 'APPROVED':
      return 'build';
    case 'RUNNING':
    case 'STUCK':
      return allPassedOnce ? 'prove' : 'build';
    case 'DONE':
      return 'handoff';
    case 'ABANDONED':
      return 'discover';
    default:
      return 'discover';
  }
}
