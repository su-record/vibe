import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { draft } from '../../dist/core/intent.js';
import { discoverySession } from './session.js';

async function fixture(run, customer = { respond: () => ({ status: 'report' }), proposal: () => ({ approved: true, answer: 'Approved local draft pilot.' }) }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-fde-protocol-test-'));
  const workspace = path.join(root, 'project');
  fs.mkdirSync(workspace);
  fs.writeFileSync(path.join(workspace, 'TASK.md'), 'Synthetic protocol test');
  let context;
  try {
    const home = path.join(root, 'fixture-home');
    fs.mkdirSync(home);
    context = await discoverySession({ workspace, customer, variant: 'status-first', repo: fileURLToPath(new URL('../../', import.meta.url)),
      env: { ...process.env, HOME: home, USERPROFILE: home, VIBE_HOME_DIR: home, VIBE_SKIP_SETUP: '1' },
      limits: { sessions: 6, clarificationRounds: 2, scopeCorrections: 1 } }, (session) => run(workspace, session));
    return context;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    for (const snapshot of context?.snapshots ?? []) fs.rmSync(snapshot.path, { recursive: true, force: true });
  }
}
function proposed(workspace) {
  fs.mkdirSync(path.join(workspace, 'out'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'out/opportunities.json'), '{}');
  fs.writeFileSync(path.join(workspace, 'out/scope.json'), '{}');
}
const reply = (finalText) => ({ finalText, ms: 1, tokens: { input: 1, cacheRead: 0, cacheWrite: 0, output: 1 } });

describe('common customer scheduling', () => {
  it('approves a clear proposal, freezes before building, and adds no empty continuation', async () => {
    const result = await fixture((workspace, session) => {
      if (session.index === 0) proposed(workspace);
      else { fs.mkdirSync(path.join(workspace, 'automation')); fs.writeFileSync(path.join(workspace, 'automation/run.cjs'), 'working pilot'); }
      return reply('report');
    });
    expect(result.sessions).toHaveLength(2);
    expect(result.clarifications).toBe(0);
    expect(result.snapshots[0].manifest['automation/run.cjs']).toBeUndefined();
    expect(result.completed).toBe(true);
    expect(result.events.find((e) => e.phase === 'approval').simulated).toBe(true);
  });
  it('retains an unclassified customer request as a harness error', async () => {
    const result = await fixture(() => reply('Tell me a consequential missing fact'), { respond: () => ({ status: 'unmatched' }) });
    expect(result.error).toContain('unclassified customer request');
    expect(result.sessions).toHaveLength(1);
    expect(result.completed).toBe(false);
  });
  it('leaves a material question unanswered after the budget, without approving a default', async () => {
    const result = await fixture(() => reply('Priority?'), { respond: () => ({ status: 'answer', answer: 'Status priority.' }) });
    expect(result.clarifications).toBe(2);
    expect(result.stalled).toBe(true);
    expect(result.approved).toBe(false);
    expect(result.answers).toHaveLength(2);
  });
  it('records premature implementation even when the eventual artifact looks good', async () => {
    const result = await fixture((workspace) => {
      proposed(workspace); fs.mkdirSync(path.join(workspace, 'automation'), { recursive: true });
      fs.writeFileSync(path.join(workspace, 'automation/run.cjs'), 'too early');
      return reply('report');
    });
    expect(result.prematureBuild).toBe(true);
  });
  it('approves a scope that hashes clarification evidence without changing the answers', async () => {
    const result = await fixture((workspace, session) => {
      if (session.index === 0) {
        proposed(workspace);
        fs.mkdirSync(path.join(workspace, 'customer'));
        fs.writeFileSync(path.join(workspace, 'customer/answers.json'), '{"answers":[{"answer":"Status first"}]}');
        draft(workspace, '# Local pilot', '- id: proof\n  then: proof exists\n  check: {type: file, path: proof.txt, exists: true}\n', ['customer/answers.json']);
      }
      return reply('report');
    });
    expect(result.error).toBeUndefined();
    expect(result.approved).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.snapshots[0].manifest['customer/consent.json']).toBeTruthy();
  });
});
