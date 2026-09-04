// No file over 400 lines (tests excluded): src/**/*.ts, hooks/*.js, mcpb/server/*.js. A file that
// outgrows one screen of purpose gets split — the total is free to grow with what the harness does.
import fs from 'node:fs';
import path from 'node:path';
const LIMIT = 400;
const root = new URL('..', import.meta.url).pathname;
const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|js)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) files.push(full);
  }
};
for (const dir of ['src', 'hooks', 'mcpb/server']) walk(path.join(root, dir));
const over = files.map((f) => [path.relative(root, f), fs.readFileSync(f, 'utf-8').split('\n').length]).filter(([, n]) => n > LIMIT);
const total = files.reduce((a, f) => a + fs.readFileSync(f, 'utf-8').split('\n').length, 0);
if (over.length > 0) {
  console.error(`files over ${LIMIT} lines:\n${over.map(([f, n]) => `  ${f} ${n}`).join('\n')}`);
  process.exit(1);
}
console.log(`${files.length} files · largest ${Math.max(...files.map((f) => fs.readFileSync(f, 'utf-8').split('\n').length))} lines (limit ${LIMIT} per file) · ${total} total`);
