// The workspace is the vibe repository at the release commit: archived from VIBE_BENCH_REPO, node_modules
// linked, built once. The repository's own records, card and skills are removed so both arms start clean.
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ws = process.cwd();
const repo = process.env.VIBE_BENCH_REPO;
if (!repo) throw new Error('VIBE_BENCH_REPO must name the vibe repository');
execSync(`git -C "${repo}" archive HEAD | tar -x -C "${ws}"`, { stdio: 'inherit' });
for (const p of ['.vibe', '.claude', 'CLAUDE.md', '.codex', 'bench']) fs.rmSync(path.join(ws, p), { recursive: true, force: true });
fs.symlinkSync(path.join(repo, 'node_modules'), path.join(ws, 'node_modules'), 'dir');
execSync('npm run build', { cwd: ws, stdio: 'ignore' });
