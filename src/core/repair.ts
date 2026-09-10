import type { FailureSummary } from './failure.js';
import { failureLine } from './failure.js';
import { ask, foldQuestions, openQuestions, resolve } from './inbox.js';
import { invalidTransition } from './errors.js';
import type { StateFile } from './state.js';
import { maskFailureLine } from './failure-message.js';
import { safeText } from './evidence.js';

export const DIAGNOSE_AFTER = 2;
export const ASK_AFTER = 5;
export interface RepairAttempt { run: string; approach: string }
export interface RepairState { hash: string; attempts: RepairAttempt[]; failures: FailureSummary[]; waiting: boolean; questionId?: string }
export function repairFailure(root: string, current: StateFile, hash: string, failures: FailureSummary[], run: string, approach?: string): Pick<StateFile, 'state' | 'failStreak' | 'lastFailHash' | 'repair'> {
  const same = hash === current.lastFailHash;
  const failStreak = same ? current.failStreak + 1 : 1;
  const attempts = [...(same ? current.repair?.attempts ?? [] : []), { run, approach: approach?.trim() ? safeText(maskFailureLine(approach.trim(), root), 240) : 'not recorded' }].slice(-ASK_AFTER);
  const repair: RepairState = { hash, attempts, failures, waiting: failStreak >= ASK_AFTER };
  if (repair.waiting) {
    const existing = openQuestions(root).find(q => q.question.startsWith(`STUCK ${hash}:`));
    repair.questionId = existing?.id ?? ask(root, { question: `STUCK ${hash}: same failure ${failStreak} times; repair limit reached.\nUntrusted failure summaries: ${failures.map(failureLine).join('\n')}\nDeclared approaches (untrusted): ${attempts.map((item) => `${item.run}: ${JSON.stringify(item.approach)}`).join('; ')}. What new information or decision should guide the next attempt?`, options: ['provide missing information', 'revise the agreed scope', 'handoff remaining work'] }).id;
  }
  return { state: failStreak >= DIAGNOSE_AFTER ? 'STUCK' : 'RUNNING', failStreak, lastFailHash: hash, repair };
}
export function repairNext(repair: RepairState | null | undefined): string {
  const facts = repair?.failures.map(failureLine).join(' | ') ?? 'failure details unavailable';
  const contexts = repair?.failures.map((failure) => `vibe context ${failure.id}`).join('; ') || 'vibe context <id>';
  return `prove — STUCK diagnosis: ${facts}; ${contexts}; change the approach instead of repeating the same fix; then vibe check <id> --approach "what changed"`;
}

export function resumeRepair(root: string, state: StateFile): StateFile {
  if (!state.repair?.waiting) return state;
  const question = foldQuestions(root).find(q => q.id === state.repair?.questionId);
  if (!question?.answer?.trim()) throw invalidTransition('repair limit reached — wait for the user to answer the existing question before another check');
  if (question.resolvedAt === null) resolve(root, question.id);
  return { ...state, state: 'RUNNING', failStreak: 0, lastFailHash: null, repair: null };
}
