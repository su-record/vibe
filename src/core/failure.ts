import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { CheckResult } from './checks/run.js';
import type { Scenario } from './scenarios.js';
import { failureMessage, maskFailureLine } from './failure-message.js';
import { safeText } from './evidence.js';

export interface FailureLocation { file: string; line: number }
export interface FailureSummary {
  id: string; target: string; exit: number | null; cause: string;
  message: string | null; diagnosticCode: string | null; causeHash: string | null;
  locations: FailureLocation[]; logs: string[];
}
const code = (value: string | undefined): string => value && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(value) ? value : 'unclassified-failure';
export function checkTarget(scenario: Scenario): string {
  const check = scenario.check;
  return check.type === 'run' ? check.cmd : check.type === 'eval' ? check.runner : 'path' in check ? check.path : check.type === 'http' ? check.url : 'human confirmation';
}
function projectFile(root: string, name: string): string | null {
  if (name.length > 240 || /[\u0000-\u001f]/.test(name)) return null;
  const file = path.resolve(root, name), relative = path.relative(root, file);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
  try {
    const actual = path.relative(fs.realpathSync(root), fs.realpathSync(file));
    if (actual === '..' || actual.startsWith(`..${path.sep}`) || path.isAbsolute(actual)) return null;
    return fs.statSync(file).isFile() ? relative.split(path.sep).join('/') : null;
  } catch { return null; }
}
function locations(root: string, text: string): FailureLocation[] {
  const found: FailureLocation[] = [];
  const pattern = /((?:[A-Za-z]:)?[^\s"'()[\]<>]+?\.(?:[cm]?[jt]sx?|json|ya?ml|py|sh|cjs|md|sql))(?::(\d+)(?::\d+)?|\((\d+),\d+\))/g;
  for (const match of text.matchAll(pattern)) {
    const file = projectFile(root, match[1]!); const line = Number(match[2] ?? match[3]);
    if (file && Number.isSafeInteger(line) && line > 0 && !found.some((item) => item.file === file)) found.push({ file, line });
    if (found.length >= 8) break;
  }
  return found;
}
/** Extract facts, fingerprints and one masked cause line. Process output never supplies procedure. */
export function summarizeFailure(root: string, scenario: Scenario, result: CheckResult): FailureSummary {
  const text = result.raw ? `${result.raw.stdout.toString('utf8')}\n${result.raw.stderr.toString('utf8')}` : result.tail;
  const clean = text.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
  const line = clean.split('\n').filter((item) => /\berror\b|\bfailed\b|\bTS\d{4,5}\b/i.test(item)).at(-1)?.trim().slice(0, 1000);
  const logs = [...new Set((clean.match(/[^\s"'<>]+\.log\b/g) ?? []).map((name) => projectFile(root, name)).filter((name): name is string => name !== null))].slice(0, 4);
  return { id: scenario.id, target: safeText(maskFailureLine(checkTarget(scenario), root), 240), exit: result.exit, cause: code(result.failureCode),
    message: failureMessage(clean, root), diagnosticCode: clean.match(/\b(?:TS\d{4,5}|E(?:NOENT|ACCES|CONNREFUSED|TIMEDOUT))\b/)?.[0] ?? null,
    causeHash: line ? createHash('sha256').update(line).digest('hex') : null, locations: locations(root, clean), logs };
}
export function failureLine(failure: FailureSummary): string {
  const at = failure.locations[0];
  return `${failure.id}: check=${JSON.stringify(failure.target)} exit=${failure.exit ?? 'none'} cause=${failure.cause}${failure.diagnosticCode ? `/${failure.diagnosticCode}` : ''}${failure.message ? ` message=${JSON.stringify(failure.message)}` : ''}${at ? ` at ${at.file}:${at.line}` : ''}${failure.logs.length ? ` logs=${failure.logs.join(',')}` : ''}`;
}
