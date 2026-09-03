import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { approvalNeedsToken, irreversibleNeedsToken, parseTokenPolicy, readConfig, writeConfig } from './config.js';
import { VibeError } from './errors.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-config-'));
  fs.mkdirSync(path.join(root, '.vibe'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('token policy', () => {
  it('defaults to irreversible and ignores garbage', () => {
    expect(readConfig(root).tokens).toBe('irreversible');
    fs.writeFileSync(path.join(root, '.vibe', 'config.json'), '{"tokens":"sometimes"}');
    expect(readConfig(root).tokens).toBe('irreversible');
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
});
