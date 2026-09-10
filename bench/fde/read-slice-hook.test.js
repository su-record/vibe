import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sliceCounter, withSliceCounts } from './read-slice-source.js';
import { recordSession } from './accounting.js';
import { attemptEvidence, readLines } from './evidence.js';

const product = fileURLToPath(new URL('../..', import.meta.url));

it('collects actual private hook counters through fixture HOME into session and attempt evidence', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-bench-slice-'));
  const workspace = path.join(root, 'project'), home = path.join(root, 'home'), ledger = path.join(root, 'shared.jsonl');
  const env = { ...process.env, HOME: home, USERPROFILE: home, VIBE_HOME_DIR: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_PROJECT_DIR: workspace, VIBE_CLIENT: 'codex' };
  for (const directory of [home, path.join(workspace, 'specs'), path.join(workspace, 'docs')]) fs.mkdirSync(directory, { recursive: true });
  for (const file of ['specs/private-plan.md', 'docs/private-notes.md', 'private-output.log']) fs.writeFileSync(path.join(workspace, file), 'one\ntwo\n');
  const pre = (command) => spawnSync(process.execPath, [path.join(product, 'hooks/notify.js'), 'pre'], { cwd: workspace, env, encoding: 'utf8', timeout: 30000,
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }) });
  try {
    const counter = sliceCounter('scoped-4.1.26', product, workspace, env);
    expect(counter.read()).toEqual({ blocked: 0, warned: 0 });
    const observations = [], sessions = [];
    sessions.push(await withSliceCounts(counter, async () => {
      expect(pre('head specs/private-plan.md').status).toBe(2);
      expect(pre('head docs/private-notes.md').status).toBe(0);
      expect(pre('cat specs/private-plan.md').status).toBe(0);
      expect(pre('tail private-output.log').status).toBe(0);
      return { tokens: { input: 1, cacheRead: 0, cacheWrite: 0, output: 1 }, ms: 1 };
    }, (reading) => observations.push(reading)));
    sessions.push(await withSliceCounts(counter, async () => {
      expect(pre('head specs/private-plan.md').status).toBe(2);
      return { tokens: { input: 1, cacheRead: 0, cacheWrite: 0, output: 1 }, ms: 1 };
    }, (reading) => observations.push(reading)));
    expect(observations.map((reading) => reading.counts)).toEqual([{ blocked: 1, warned: 1 }, { blocked: 1, warned: 0 }]);
    sessions.forEach((result, index) => recordSession(result, { identity: { id: 'fixture' }, session: index + 1, workspace, ledger, records: [], prices: {}, sideCount: 0 }));
    const records = readLines(ledger);
    expect(records.filter((row) => row.event === 'session-usage').map((row) => row.sliceReads.counts)).toEqual(observations.map((reading) => reading.counts));
    const row = attemptEvidence({ workspace, sessions, events: [], answers: [], snapshots: [], completed: false }, { id: 'fixture', arm: 'scoped-4.1.26' }, null, {});
    expect(row.sliceReads.counts).toEqual({ blocked: 2, warned: 1 });
    expect(JSON.stringify(records)).not.toContain('private-plan'); expect(JSON.stringify(row)).not.toContain('private-notes');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}, 120000);
