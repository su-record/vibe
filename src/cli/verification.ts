import { verificationPlan } from '../core/verification-plan.js';
import type { Flags, Output } from './common.js';

export function cmdVerification(root: string, ids: string[], flags: Flags): Output {
  const json = verificationPlan(root, { ids, all: flags['all'] === true });
  return { json, text: JSON.stringify(json, null, 2), code: 0 };
}
