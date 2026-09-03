// 상시 카드 1KB 상한 — 넘기면 다시 vibe 3 이다.
import fs from 'node:fs';
const bytes = Buffer.byteLength(fs.readFileSync(new URL('../card.md', import.meta.url), 'utf-8'), 'utf-8');
console.log(`card.md ${bytes} bytes (limit 1024)`);
process.exit(bytes <= 1024 ? 0 : 1);
