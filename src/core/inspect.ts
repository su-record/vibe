import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { denied } from './errors.js';
import { vibePath } from './paths.js';
import { parseScenarios, type Scenario, type Rejection } from './scenarios.js';
import { readSourceBasis } from './source-basis.js';
import { roleChoice } from './config.js';

export const hashBytes = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export const fingerprint = (value: unknown): string => hashBytes(JSON.stringify(value));
const MAX_INPUT = 1_048_576;

export function boundedFile(file: string, limit = MAX_INPUT): Buffer {
  const absolute = path.resolve(file);
  let part = path.parse(absolute).root;
  for (const component of absolute.slice(part.length).split(path.sep).filter(Boolean)) {
    part = path.join(part, component);
    if (fs.lstatSync(part).isSymbolicLink()) throw denied('inspection requires regular files without linked path components');
  }
  const fd = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > limit) throw denied('inspection input is not a regular file within the byte limit');
    const buffer = Buffer.alloc(limit + 1);
    const length = fs.readSync(fd, buffer, 0, buffer.length, 0);
    if (length > limit) throw denied('inspection input exceeds the byte limit');
    return buffer.subarray(0, length);
  } finally { fs.closeSync(fd); }
}

export function inspectContract(root: string, files: string[] = []): { intent: string; scenarios: Scenario[]; rejections: Rejection[]; untrusted: true } {
  root = fs.realpathSync(root);
  const rejections: Rejection[] = [];
  const read = (file: string): string => {
    try { return boundedFile(path.resolve(root, file)).toString('utf8'); }
    catch (error) { rejections.push({ id: file, reason: String((error as Error).message).slice(0, 500) }); return ''; }
  };
  if (files.length !== 0 && files.length !== 2) return { intent: '', scenarios: [], rejections: [{ id: '(arguments)', reason: 'inspect takes intent.md and scenarios.yaml together' }], untrusted: true };
  const intent = read(files[0] ?? '.vibe/intent.md');
  const parsed = parseScenarios(read(files[1] ?? '.vibe/scenarios.yaml'));
  if (!intent.trim()) rejections.push({ id: '(intent)', reason: 'intent body is empty' });
  if (!parsed.scenarios.length) rejections.push({ id: '(scenarios)', reason: 'no scenarios' });
  return { intent, scenarios: parsed.scenarios, rejections: [...rejections, ...parsed.rejections].slice(0, 100), untrusted: true };
}

export function executionShell(): string {
  const requested = process.platform === 'win32' ? process.env['ComSpec'] ?? 'C:\\Windows\\System32\\cmd.exe' : '/bin/sh';
  return fs.realpathSync(requested);
}

function verifier(root: string, file: string): { file: string; sha256: string | null; error?: string } {
  try { return { file: path.resolve(root, file), sha256: hashBytes(boundedFile(path.resolve(root, file))) }; }
  catch { return { file: path.resolve(root, file), sha256: null, error: 'verifier must be a readable regular file within the byte limit' }; }
}

function planCheck(root: string, scenario: Scenario) {
  const check = scenario.check;
  const cwd = fs.realpathSync(check.type === 'run' && check.cwd ? path.resolve(root, check.cwd) : root);
  const declared = scenario.verifiers ?? [];
  return { id: scenario.id, needs: scenario.needs ?? [], check, cwd,
    timeoutMs: 'timeoutMs' in check ? check.timeoutMs ?? (check.type === 'http' ? 30_000 : check.type === 'eval' ? 60_000 : 600_000) : null,
    expectedExit: check.type === 'run' ? check.expect ?? 0 : null,
    verifiers: declared.map((file) => verifier(root, file)),
    unresolved: check.type === 'run' || check.type === 'eval' || check.type === 'review' ? ['Only explicitly declared verifier files are bound. Shell, package and dynamic dependencies have not been transitively audited.'] : [] };
}

function inspectedRegressions(root: string): Scenario[] {
  const directory = vibePath(root, 'regressions');
  if (!fs.existsSync(directory)) return [];
  const names = fs.readdirSync(directory).filter((name) => name.endsWith('.yaml'));
  if (names.length > 256) throw denied('too many regression files to inspect safely');
  return names.sort().flatMap((name) => {
    const parsed = parseScenarios(boundedFile(path.join(directory, name)).toString('utf8'));
    if (parsed.rejections.length || !parsed.scenarios.length) throw denied('invalid inherited regression; inspect and repair it before approval');
    return parsed.scenarios;
  });
}

export function executionPlan(root: string) {
  const canonical = fs.realpathSync(root);
  const contract = inspectContract(canonical);
  if (contract.rejections.length) throw denied(`cannot preview invalid contract: ${JSON.stringify(contract.rejections)}`);
  // Regressions also execute: an imported regression cannot extend a receipt silently.
  const scenarios = [...contract.scenarios, ...inspectedRegressions(canonical)];
  const definitions = boundedFile(vibePath(canonical, 'scenarios.yaml')).toString('utf8');
  const sourceFile = vibePath(canonical, 'source-basis.json');
  if (fs.lstatSync(sourceFile, { throwIfNoEntry: false })) boundedFile(sourceFile);
  return { schemaVersion: 1, project: canonical, contract: fingerprint({ intent: contract.intent, definitions, sources: readSourceBasis(canonical) }),
    platform: process.platform, shell: executionShell(), node: fs.realpathSync(process.execPath),
    path: process.env['PATH'] ?? '', pathExt: process.env['PATHEXT'] ?? '',
    reviewer: { choice: roleChoice(canonical, 'reviewer'), command: process.env['VIBE_REVIEW_CMD'] ?? null, client: process.env['VIBE_REVIEW_CLIENT'] ?? null },
    checks: scenarios.map((scenario) => planCheck(canonical, scenario)) };
}

export type ExecutionPlan = ReturnType<typeof executionPlan>;
