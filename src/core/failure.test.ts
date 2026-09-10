import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { summarizeFailure } from './failure.js';
import { failureMessage } from './failure-message.js';
import type { Scenario } from './scenarios.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-failure-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
it('retains a database cause and a wrapper failure location without retaining its raw transcript', () => {
  const file = 'apps/web/tests/e2e/tomi-profile.spec.ts';
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), 'export {};');
  const tail = `RAW-CANARY\n${path.join(root, file)}:171: error: function ag_catalog.create_vlabel(unknown, name) does not exist\nFAIL wrapper.test.ts\nTest Files 1 failed | 4 passed`;
  const scenario: Scenario = { id: 'database', given: '', when: '', then: 'valid labels', check: { type: 'run', cmd: 'node checks/wrapper.cjs' } };
  const failure = summarizeFailure(root, scenario, { pass: false, exit: 1, ms: 12, tail, failureCode: 'exit-mismatch' });
  expect(failure.locations).toEqual([{ file, line: 171 }]);
  expect(failure.message).toContain('function ag_catalog.create_vlabel(unknown, name) does not exist');
  expect(JSON.stringify(failure)).not.toContain('RAW-CANARY');
  expect(JSON.stringify(failure)).not.toContain(root);
});
it('masks known secret forms, external paths, controls and excessive output while keeping a lint cause', () => {
  const message = failureMessage('\u001b[31merror no-undef\u202e password=hidden Bearer secret user@example.invalid https://u:p@host.invalid/path?q=private /outside/private.key ' + 'x'.repeat(500), root);
  expect(message).toContain('no-undef');
  expect(message!.length).toBeLessThanOrEqual(200);
  for (const raw of ['\u001b', '\u202e', 'hidden', 'Bearer secret', 'user@example.invalid', 'u:p@', 'q=private', '/outside/private.key']) expect(message).not.toContain(raw);
});
it('masks quoted JSON keys and whole quoted credentials without selecting a source-code frame', () => {
  const diagnostic = 'Error: {"api_key":"local-secret-123","password":"short-password"} password="correct horse battery staple"';
  const message = failureMessage(diagnostic + '\n76| expect(result.error).toBeUndefined();', root);
  expect(message).toContain('Error:');
  for (const secret of ['local-secret-123', 'short-password', 'correct', 'horse', 'battery', 'staple', 'expect(result.error)']) expect(message).not.toContain(secret);
  expect(failureMessage('AssertionError: expected 3 to be +0\n76| expect(result.error).toBeUndefined();', root)).toBe('AssertionError: expected 3 to be +0');
});
it('navigates to an existing SQL migration instead of only its wrapper', () => {
  fs.mkdirSync(path.join(root, 'migrations'));
  fs.writeFileSync(path.join(root, 'migrations/0129_graph.sql'), 'select 1;');
  const failure = summarizeFailure(root, { id: 'database', then: 'labels exist', check: { type: 'run', cmd: 'node wrapper.cjs' } }, {
    pass: false, exit: 1, ms: 1, tail: 'migrations/0129_graph.sql:52: error: function ag_catalog.create_vlabel(unknown, name) does not exist',
  });
  expect(failure.locations[0]).toEqual({ file: 'migrations/0129_graph.sql', line: 52 });
  expect(failure.message).toContain('function ag_catalog.create_vlabel');
});
