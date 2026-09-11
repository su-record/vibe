import { benchmarkStartup, performanceReport } from '../core/performance.js';
import { usage } from '../core/errors.js';
import type { Output } from './common.js';

export function cmdPerformance(root: string, args: string[]): Output {
  if (args.length !== 1 || !['report', 'startup'].includes(args[0]!)) throw usage('internal performance report | startup');
  const json = args[0] === 'startup' ? benchmarkStartup(root) : performanceReport(root);
  return { json, text: JSON.stringify(json, null, 2), code: 0 };
}
