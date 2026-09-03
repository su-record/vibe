import { randomInt } from 'node:crypto';
import { vibePath } from './paths.js';
import { appendJsonl, nowIso, readJsonl } from './store.js';
import { issueToken, type TokenKind } from './tokens.js';

/** 인박스 — 질문·답·STUCK·토큰이 한 파일에 append 된다. 사람이 읽을 수 있다. */
export interface QuestionEvent {
  type: 'question';
  id: string;
  at: string;
  question: string;
  options?: string[];
  default?: string;
  needs?: TokenKind;
  target?: string;
  tokenId?: string;
  scenario?: string;
}
interface AnswerEvent {
  type: 'answer';
  id: string;
  at: string;
  answer: string;
}
interface ResolveEvent {
  type: 'resolve';
  id: string;
  at: string;
}
export type InboxEvent = QuestionEvent | AnswerEvent | ResolveEvent | { type: string; id: string };

export interface QuestionView extends QuestionEvent {
  answer: string | null;
  resolvedAt: string | null;
}

export function inboxPath(root: string): string {
  return vibePath(root, 'inbox.jsonl');
}

export interface AskInput {
  question: string;
  options?: string[];
  default?: string;
  needs?: { kind: TokenKind; target: string };
  scenario?: string;
}

export function ask(root: string, input: AskInput): { id: string; token: string | null; expiresAt: string | null } {
  const id = `q-${Date.now().toString(36)}-${randomInt(0, 4096).toString(36)}`;
  let token: string | null = null;
  let expiresAt: string | null = null;
  let tokenId: string | undefined;
  if (input.needs) {
    const issued = issueToken(root, input.needs.kind, input.needs.target);
    token = issued.token;
    expiresAt = issued.expiresAt;
    tokenId = issued.id;
  }
  const event: QuestionEvent = { type: 'question', id, at: nowIso(), question: input.question };
  if (input.options) event.options = input.options;
  if (input.default) event.default = input.default;
  if (input.needs) {
    event.needs = input.needs.kind;
    event.target = input.needs.target;
  }
  if (tokenId) event.tokenId = tokenId;
  if (input.scenario) event.scenario = input.scenario;
  appendJsonl(inboxPath(root), event);
  return { id, token, expiresAt };
}

export function foldQuestions(root: string): QuestionView[] {
  const views = new Map<string, QuestionView>();
  for (const event of readJsonl<InboxEvent>(inboxPath(root))) {
    if (event.type === 'question') {
      views.set(event.id, { ...(event as QuestionEvent), answer: null, resolvedAt: null });
    } else if (event.type === 'answer') {
      const view = views.get(event.id);
      if (view) view.answer = (event as AnswerEvent).answer;
    } else if (event.type === 'resolve') {
      const view = views.get(event.id);
      if (view) view.resolvedAt = (event as ResolveEvent).at;
    }
  }
  return [...views.values()];
}

export function openQuestions(root: string): QuestionView[] {
  return foldQuestions(root).filter((q) => q.resolvedAt === null);
}

export function answer(root: string, id: string, text: string): boolean {
  if (!foldQuestions(root).some((q) => q.id === id)) return false;
  appendJsonl(inboxPath(root), { type: 'answer', id, at: nowIso(), answer: text } satisfies AnswerEvent);
  return true;
}

export function resolve(root: string, id: string): boolean {
  if (!foldQuestions(root).some((q) => q.id === id)) return false;
  appendJsonl(inboxPath(root), { type: 'resolve', id, at: nowIso() } satisfies ResolveEvent);
  return true;
}

/** 같은 시나리오·같은 질문이 이미 열려 있으면 다시 묻지 않는다. */
export function hasOpenQuestion(root: string, predicate: (q: QuestionView) => boolean): boolean {
  return openQuestions(root).some(predicate);
}
