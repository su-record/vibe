import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { approvalNeedsToken, irreversibleNeedsToken, parseTokenPolicy, readConfig, writeConfig, roleChoice } from './config.js';
import { VibeError } from './errors.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-config-'));
  fs.mkdirSync(path.join(root, '.vibe'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('token policy', () => {
  it('defaults to irreversible and ignores garbage', () => {
    expect(readConfig(root).tokens).toBe('off');
    fs.writeFileSync(path.join(root, '.vibe', 'config.json'), '{"tokens":"sometimes"}');
    expect(readConfig(root).tokens).toBe('off');
  });

  it('round-trips through config.json', () => {
    writeConfig(root, { tokens: 'off' });
    expect(readConfig(root).tokens).toBe('off');
  });

  it('maps policies to what needs a token', () => {
    expect([approvalNeedsToken('strict'), approvalNeedsToken('irreversible'), approvalNeedsToken('off')]).toEqual([true, false, false]);
    expect([irreversibleNeedsToken('strict'), irreversibleNeedsToken('irreversible'), irreversibleNeedsToken('off')]).toEqual([true, true, false]);
  });

  it('rejects unknown policies with a usage error', () => {
    expect(() => parseTokenPolicy('maybe')).toThrowError(VibeError);
    expect(parseTokenPolicy('strict')).toBe('strict');
  });

  it('model: reader and reviewer objects are read, a reader string stays a command, and the env overrides a role for one run', () => {
    fs.mkdirSync(path.join(root, '.vibe'), { recursive: true });
    fs.writeFileSync(path.join(root, '.vibe', 'config.json'), JSON.stringify({ reader: { model: 'r-model', effort: 'low' }, reviewer: { model: 'v-model' } }));
    expect(readConfig(root)).toMatchObject({ readerModel: { model: 'r-model', effort: 'low' }, reviewerModel: { model: 'v-model' } });
    expect(readConfig(root).reader).toBeUndefined();
    expect(roleChoice(root, 'reader')).toEqual({ model: 'r-model', effort: 'low' });
    expect(roleChoice(root, 'reviewer')).toEqual({ model: 'v-model' });
    process.env['VIBE_REVIEWER_EFFORT'] = 'high';
    process.env['VIBE_READER_MODEL'] = 'env-model';
    try {
      expect(roleChoice(root, 'reviewer')).toEqual({ model: 'v-model', effort: 'high' });
      expect(roleChoice(root, 'reader')).toEqual({ model: 'env-model', effort: 'low' });
    } finally {
      delete process.env['VIBE_REVIEWER_EFFORT'];
      delete process.env['VIBE_READER_MODEL'];
    }
    fs.writeFileSync(path.join(root, '.vibe', 'config.json'), JSON.stringify({ reader: 'my-reader --fast', reviewer: {} }));
    expect(readConfig(root)).toMatchObject({ reader: 'my-reader --fast' });
    expect(readConfig(root).reviewerModel).toBeUndefined();
    expect(roleChoice(root, 'reviewer')).toEqual({});
  });
});
