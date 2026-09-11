import fs from 'node:fs';
import { vibePath } from './paths.js';
import { writeState, type StateFile } from './state.js';
import { ensureDir } from './store.js';

/** Reserve before execution. A crash may leave a gap; it must never reuse another run's evidence. */
export function reserveRun(root: string, state: StateFile): string {
  ensureDir(vibePath(root, 'runs'));
  let number = state.runs;
  for (;;) {
    const run = `r-${++number}`;
    if (fs.existsSync(vibePath(root, 'evidence', `${run}.json`))) continue;
    try { fs.writeFileSync(vibePath(root, 'runs', run), '', { flag: 'wx' }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue; throw error; }
    writeState(root, { ...state, runs: number, state: 'RUNNING', doneAt: null, doneTree: null });
    return run;
  }
}

export function writeRunEvidence(root: string, run: string, evidence: unknown): void {
  ensureDir(vibePath(root, 'evidence'));
  fs.writeFileSync(vibePath(root, 'evidence', `${run}.json`), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
}
