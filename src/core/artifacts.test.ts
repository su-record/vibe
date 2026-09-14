import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { artifactsFresh, captureArtifacts } from './artifacts.js';
import { artifactPathsValid } from './artifact-paths.js';
import { runChecks, readResults, invalidateDoneIfEdited } from './check.js';
import { approve, draft } from './intent.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-artifacts-'));
  fs.mkdirSync(path.join(root, '.vibe'));
  fs.mkdirSync(path.join(root, 'dist'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
function contract(extra = '') {
  const d = draft(root, '# Output verification', `
- id: output
  then: the output is usable
  artifacts: [dist/result.txt]
  check: {type: run, cmd: 'node -e "process.exit(0)"'}
${extra}`);
  if (!d.ok) throw new Error(JSON.stringify(d.rejections));
  approve(root, d.token);
}

it('exit zero with a missing output fails and blocks dependent execution', async () => {
  contract(`- id: use-output
  then: consume the output
  needs: [output]
  check: {type: run, cmd: 'node -e "process.exit(0)"'}`);
  const report = await runChecks(root);
  expect(report.done).toBe(false);
  expect(report.outcomes[0]).toMatchObject({ status: 'fail', exit: 0, failureCode: 'artifact-unavailable' });
  expect(report.outcomes[1]).toMatchObject({ status: 'blocked', exit: null });
});

it.each(['delete', 'change'])('invalidates DONE when ignored output is %s', async action => {
  const file = path.join(root, 'dist/result.txt');
  fs.writeFileSync(file, 'good');
  contract();
  expect((await runChecks(root)).done).toBe(true);
  const evidence = fs.readFileSync(path.join(root, '.vibe/evidence/r-1.json'), 'utf8');
  expect(JSON.parse(evidence).results[0].artifacts['dist/result.txt'].bytes).toBe(4);
  if (action === 'delete') fs.unlinkSync(file); else fs.writeFileSync(file, 'evil');
  expect(readResults(root).output?.last).toBe('stale');
  expect(invalidateDoneIfEdited(root)).toBe(true);
  expect(fs.readFileSync(path.join(root, '.vibe/evidence/r-1.json'), 'utf8')).toBe(evidence);
});

it('withholds completion if a later step changes an earlier output', async () => {
  fs.writeFileSync(path.join(root, 'dist/result.txt'), 'good');
  fs.writeFileSync(path.join(root, 'change.cjs'), "require('fs').writeFileSync('dist/result.txt', 'evil')");
  contract(`- id: later
  then: later processing
  needs: [output]
  check: {type: run, cmd: node change.cjs}`);
  const report = await runChecks(root);
  expect(report.done).toBe(false);
  expect(report.outcomes[0]).toMatchObject({ status: 'stale', reason: 'artifact-changed' });
});

it('bounds file reads, rejects escapes and directories, and supports ordinary filenames', () => {
  for (const files of [[], ['/etc/passwd'], ['../secret'], ['.vibe/results.json'], ['.VIBE/results.json'], ['.vibe./results.json'], ['a/../../b'], ['a\\b']]) expect(artifactPathsValid(files)).toBe(false);
  expect(() => captureArtifacts(root, ['dist'])).toThrow();
  fs.writeFileSync(path.join(root, '__proto__'), 'safe');
  const proof = captureArtifacts(root, ['__proto__']);
  expect(Object.keys(proof!)).toEqual(['__proto__']);
  expect(artifactsFresh(root, proof)).toBe(true);
  const large = path.join(root, 'dist/large');
  fs.closeSync(fs.openSync(large, 'w'));
  fs.truncateSync(large, 16 * 1024 * 1024 + 1);
  expect(() => captureArtifacts(root, ['dist/large'])).toThrow('artifact byte limit');
  expect(artifactsFresh('/does-not-exist')).toBe(true);
});

it('rebuilds a stale prerequisite before explicitly selected downstream work', async () => {
  fs.writeFileSync(path.join(root, 'dist/result.txt'), 'good');
  contract(`- id: consumer
  then: consume the output
  needs: [output]
  check: {type: run, cmd: 'node -e "process.exit(0)"'}`);
  expect((await runChecks(root)).done).toBe(true);
  fs.unlinkSync(path.join(root, 'dist/result.txt'));
  const report = await runChecks(root, { ids: ['consumer'] });
  expect(report.outcomes.map(o => [o.id, o.status])).toEqual([['output', 'fail'], ['consumer', 'blocked']]);
  expect(report.done).toBe(false);
});

it.skipIf(process.platform === 'win32')('rejects symlink files and symlink parent directories', () => {
  fs.writeFileSync(path.join(root, 'dist/result.txt'), 'good');
  fs.symlinkSync(path.join(root, 'dist/result.txt'), path.join(root, 'linked-file'));
  fs.symlinkSync(path.join(root, 'dist'), path.join(root, 'linked-dir'));
  expect(() => captureArtifacts(root, ['linked-file'])).toThrow();
  expect(() => captureArtifacts(root, ['linked-dir/result.txt'])).toThrow();
});

it('invalidates cached downstream evidence when a prerequisite output changes', async () => {
  fs.writeFileSync(path.join(root, 'dist/result.txt'), 'good');
  contract(`- id: consumer
  then: accept only good output
  needs: [output]
  check: {type: file, path: dist/result.txt, contains: good}`);
  expect((await runChecks(root)).done).toBe(true);
  fs.writeFileSync(path.join(root, 'dist/result.txt'), 'evil');
  expect(readResults(root).consumer?.last).toBe('stale');
  const report = await runChecks(root);
  expect(report.outcomes.map(o => [o.id, o.status])).toEqual([['output', 'pass'], ['consumer', 'fail']]);
  expect(report.done).toBe(false);
});

it('cannot reuse a consumer after an explicitly rerun producer changes its output', async () => {
  fs.writeFileSync(path.join(root, 'dist/result.txt'), 'good');
  fs.writeFileSync(path.join(root, 'produce.cjs'), "require('fs').writeFileSync('dist/result.txt', process.env.VIBE_ARTIFACT_TEST_VALUE || 'good')");
  const d = draft(root, '# Producer and consumer', `
- id: producer
  then: create output
  artifacts: [dist/result.txt]
  check: {type: run, cmd: node produce.cjs}
- id: consumer
  then: accept good output
  needs: [producer]
  check: {type: file, path: dist/result.txt, contains: good}`);
  if (!d.ok) throw new Error(JSON.stringify(d.rejections));
  approve(root, d.token);
  expect((await runChecks(root)).done).toBe(true);
  const previous = process.env.VIBE_ARTIFACT_TEST_VALUE;
  process.env.VIBE_ARTIFACT_TEST_VALUE = 'evil';
  try {
    const report = await runChecks(root, { ids: ['producer'] });
    expect(report.outcomes[0]?.status).toBe('pass');
    expect(report.done).toBe(false);
    expect(report.remaining).toContain('consumer');
  } finally {
    if (previous === undefined) delete process.env.VIBE_ARTIFACT_TEST_VALUE;
    else process.env.VIBE_ARTIFACT_TEST_VALUE = previous;
  }
});
