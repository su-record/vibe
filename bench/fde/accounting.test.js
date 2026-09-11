import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordSession, budgetReason } from './accounting.js';
import { readLines, usageSummary } from './evidence.js';
import { packetId } from './reviews.js';

it('preserves paid main usage before corrupt product evidence and stops further calls', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-accounting-'));
  const ledger = path.join(workspace, 'outer-ledger.jsonl');
  try {
    fs.mkdirSync(path.join(workspace, '.vibe'));
    fs.writeFileSync(path.join(workspace, '.vibe/ledger.jsonl'), 'partial JSON');
    const result = { tokens: { input: 25, cacheRead: 10, cacheWrite: 0, output: 5 }, costUsd: 0.1 };
    recordSession(result, { identity: { id: 'attempt-1' }, session: 1, workspace, ledger, records: [], prices: {}, sideCount: 0 });
    const records = readLines(ledger);
    expect(records[0].event).toBe('session-result');
    expect(records[0].result.tokens.input).toBe(25);
    expect(records[1].mainTokens.input).toBe(25);
    expect(records[1].tokens).toBeNull();
    expect(result.error).toBe('AGENT_EVIDENCE_UNAVAILABLE');
    expect(budgetReason({ budget: { rawTokens: 10000, wallMs: 10000 } }, records, Date.now())).toBe('USAGE_MISSING');
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

it('does not turn benchmark cache weights into provider prices', () => {
  const sessions = [{ requestedModel: 'configured-model', tokens: { input: 100, cacheRead: 100, cacheWrite: 20, output: 10 }, costUsd: null }];
  const unknown = usageSummary(sessions, [], { 'configured-model': { input: 2, output: 4 } });
  expect(unknown.weightedInput).toBe(135);
  expect(unknown.costUsd).toBeNull();
  const known = usageSummary(sessions, [], { 'configured-model': { input: 2, cacheRead: 0.4, cacheWrite: 3, output: 4 } });
  expect(known.costUsd).toBeCloseTo(0.00034);
});

it('makes identical neutral scopes independently reviewable without exposing the arm', () => {
  const scopeSnapshots = [{ hash: 'identical-content' }];
  const first = packetId({ id: 'codex/status-first/off/1', protocolHash: 'protocol', scopeSnapshots });
  const second = packetId({ id: 'codex/status-first/off/2', protocolHash: 'protocol', scopeSnapshots });
  expect(first).not.toBe(second);
  expect(first).toMatch(/^[a-f0-9]{64}$/);
});

it('stops after a paid invocation was interrupted before any result arrived', () => {
  const pending = [{ id: 'attempt-1', event: 'session-start', session: 1 }];
  expect(budgetReason({ budget: { rawTokens: 10000, wallMs: 10000 } }, pending, Date.now())).toBe('SESSION_USAGE_INTERRUPTED');
});
