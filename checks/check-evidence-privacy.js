import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'src/core/evidence.test.ts'], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
