import { conventionsPath, updateConventions } from '../core/conventions.js';
import { readText } from '../core/store.js';
import { ensureProject } from '../install/project.js';
import type { Flags, Output } from './common.js';

/** `--json` is handled by the dispatcher; both shapes are always ready here. */
export function cmdConventions(root: string, _flags: Flags): Output {
  ensureProject(root);
  const result = updateConventions(root);
  const file = conventionsPath(root);
  const text = (readText(file) ?? '').trim().split('\n').filter(Boolean);
  const lines = [`conventions: ${result.total} line(s) · ${result.added.length} new`, ...text];
  return { json: { ...result, file }, text: lines.join('\n'), code: 0 };
}
