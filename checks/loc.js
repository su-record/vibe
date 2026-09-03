// 소스 5000 줄 상한 (테스트 제외). 크기가 곧 vibe 3 으로 되돌아가는 첫 신호다.
import fs from 'node:fs';
import path from 'node:path';
const root = new URL('../src', import.meta.url).pathname;
let total = 0;
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) total += fs.readFileSync(full, 'utf-8').split('\n').length;
  }
};
walk(root);
console.log(`src (non-test) ${total} lines (limit 5000)`);
process.exit(total <= 5000 ? 0 : 1);
