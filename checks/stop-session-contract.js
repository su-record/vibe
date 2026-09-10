import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
execFileSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'src/core/session.test.ts', 'src/install/notify.test.ts', 'src/install/tree.test.ts'], { cwd: root, stdio: 'inherit' });
