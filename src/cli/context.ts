import { buildContext, renderContext } from '../core/context.js';
import { usage } from '../core/errors.js';
import type { Flags, Output } from './common.js';

/** `--json` is handled by the dispatcher; both shapes are always ready here. */
export function cmdContext(root: string, args: string[], _flags: Flags): Output {
  const id = args[0];
  if (!id) throw usage('context <scenario> [--json]');
  const bundle = buildContext(root, id);
  return { json: bundle, text: renderContext(bundle), code: 0 };
}
