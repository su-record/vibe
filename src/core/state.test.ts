import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VibeError } from './errors.js';
import { canTransition, readState, stageOf, transition, TRANSITIONS } from './state.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-state-'));
  fs.mkdirSync(path.join(root, '.vibe'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('state machine', () => {
  it('rejects transitions outside the table with exit 4 — NONE → DONE', () => {
    expect(readState(root).state).toBe('NONE');
    expect(() => transition(root, 'DONE')).toThrowError(VibeError);
    try {
      transition(root, 'APPROVED');
    } catch (error) {
      expect((error as VibeError).exitCode).toBe(4);
    }
    expect(readState(root).state).toBe('NONE');
  });

  it('walks the allowed path — NONE → DRAFT → APPROVED → RUNNING → DONE', () => {
    transition(root, 'DRAFT');
    transition(root, 'APPROVED');
    transition(root, 'RUNNING');
    transition(root, 'DONE');
    expect(readState(root).state).toBe('DONE');
    expect(canTransition('DONE', 'RUNNING')).toBe(true);
    expect(canTransition('ABANDONED', 'APPROVED')).toBe(false);
  });

  it('covers every state in the table', () => {
    for (const from of Object.keys(TRANSITIONS)) expect(TRANSITIONS[from as keyof typeof TRANSITIONS].length).toBeGreaterThan(0);
  });

  it('derives the stage from state', () => {
    const base = readState(root);
    expect(stageOf({ ...base, state: 'NONE' }, false, false)).toBe('discover');
    expect(stageOf({ ...base, state: 'DRAFT' }, true, false)).toBe('scope');
    expect(stageOf({ ...base, state: 'RUNNING' }, true, false)).toBe('build');
    expect(stageOf({ ...base, state: 'RUNNING' }, true, true)).toBe('prove');
    expect(stageOf({ ...base, state: 'DONE' }, true, true)).toBe('handoff');
  });
});
