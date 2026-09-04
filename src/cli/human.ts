import { detectClient, detectModel } from '../core/client.js';
import { irreversibleNeedsToken, readConfig } from '../core/config.js';
import { denied, usage } from '../core/errors.js';
import { answer, ask, openQuestions, resolve as resolveQuestion } from '../core/inbox.js';
import { record } from '../core/ledger.js';
import { readState } from '../core/state.js';
import { verifyAndConsume } from '../core/tokens.js';
import { ensureProject } from '../install/project.js';
import { flagString, type Flags, type Output } from './common.js';

export function cmdAsk(root: string, args: string[], flags: Flags): Output {
  ensureProject(root);
  const question = args.join(' ');
  if (!question) throw usage('ask "question"');
  const options = flagString(flags, 'options')?.split('|').map((s) => s.trim()).filter(Boolean);
  const needsRaw = flagString(flags, 'needs');
  let needs: { kind: 'approve' | 'authorize'; target: string } | undefined;
  const policy = readConfig(root).tokens;
  if (needsRaw === 'approve') {
    const state = readState(root);
    if (state.state !== 'DRAFT' || !state.intentHash) throw denied('an approval token can only be issued in DRAFT');
    if (policy === 'strict') needs = { kind: 'approve', target: state.intentHash };
  } else if (needsRaw?.startsWith('authorize:')) {
    const action = needsRaw.slice('authorize:'.length);
    if (irreversibleNeedsToken(policy)) needs = { kind: 'authorize', target: `${action}:${flagString(flags, 'target') ?? ''}` };
  } else if (needsRaw) {
    throw usage('--needs takes approve or authorize:<action>');
  }
  const input: Parameters<typeof ask>[1] = { question };
  if (options && options.length) input.options = options;
  const def = flagString(flags, 'default');
  if (def) input.default = def;
  if (needs) input.needs = needs;
  const result = ask(root, input);
  record(root, { event: 'ask', client: detectClient(), model: detectModel(), detail: question.slice(0, 120) });
  const text = [
    `question recorded [${result.id}]`,
    ...(result.token ? [`token: ${result.token} (valid until ${result.expiresAt}) — the user must paste it back in chat before anything proceeds`] : []),
    ...(needsRaw && !result.token ? [`tokens: ${policy} — no token needed; proceed when the user says yes`] : []),
  ].join('\n');
  return { json: { ...result, policy }, text, code: 0 };
}

export function cmdAuthorize(root: string, args: string[], flags: Flags): Output {
  ensureProject(root);
  const token = args.join(' ') || null;
  const action = flagString(flags, 'action');
  if (!action) throw usage('authorize [token] --action push|deploy|send|delete|spend [--target "…"]');
  const target = `${action}:${flagString(flags, 'target') ?? ''}`;
  const policy = readConfig(root).tokens;
  let basis: 'token' | 'auto' = 'auto';
  if (irreversibleNeedsToken(policy)) {
    if (!token) throw denied(`"${action}" needs a human token here (tokens: ${policy})`);
    const verdict = verifyAndConsume(root, 'authorize', target, token);
    if (!verdict.ok) throw denied(verdict.reason);
    basis = 'token';
  }
  record(root, { event: 'authorize', client: detectClient(), model: detectModel(), detail: `${target} by ${basis}` });
  return { json: { ok: true, action, target, basis }, text: `authorized: ${target} (by ${basis})`, code: 0 };
}

export function cmdInbox(root: string, sub: string | undefined, args: string[]): Output {
  if (sub === 'answer') {
    const [id, ...rest] = args;
    if (!id || rest.length === 0) throw usage('inbox answer <id> "text"');
    if (!answer(root, id, rest.join(' '))) throw usage(`no such question: ${id}`);
    return { json: { ok: true }, text: `answered ${id}`, code: 0 };
  }
  if (sub === 'resolve') {
    const [id] = args;
    if (!id) throw usage('inbox resolve <id>');
    if (!resolveQuestion(root, id)) throw usage(`no such question: ${id}`);
    return { json: { ok: true }, text: `resolved ${id}`, code: 0 };
  }
  const open = openQuestions(root);
  return { json: open, text: open.length ? open.map((q) => `[${q.id}] ${q.question}${q.options ? ` (${q.options.join(' | ')})` : ''}${q.answer ? `\n    answer: ${q.answer}` : ''}`).join('\n') : 'inbox is empty', code: 0 };
}
