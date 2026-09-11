import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'src/core/handoff.test.ts', 'src/core/handoff-results.test.ts', 'src/core/repair.test.ts'], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
