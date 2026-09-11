import { bindSession, sessionStatus } from '../core/session.js';
import { usage } from '../core/errors.js';
import { flagString, type Flags, type Output } from './common.js';

export function cmdSession(root: string, sub: string | undefined, flags: Flags): Output {
  const requested = flagString(flags, 'session');
  if (sub === 'bind') {
    const view = bindSession(root, requested);
    return { json: view, text: `Session bound to ${view.root}; revision ${view.revision}. Stop reports status; explicit checks still determine completion.`, code: 0 };
  }
  if (sub === 'status') {
    const view = sessionStatus(requested);
    return { json: view, text: `${view.status}; root=${view.root ?? 'unavailable'}; revision=${view.revision ?? 'unavailable'}; no check executed`, code: view.status === 'bound' ? 0 : 1 };
  }
  throw usage('session bind [--session id] | session status [--session id]');
}
