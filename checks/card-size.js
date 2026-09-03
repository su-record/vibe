// The always-on card is capped at 1KB — past that it is vibe 3 again.
import fs from 'node:fs';
const bytes = Buffer.byteLength(fs.readFileSync(new URL('../card.md', import.meta.url), 'utf-8'), 'utf-8');
console.log(`card.md ${bytes} bytes (limit 1024)`);
process.exit(bytes <= 1024 ? 0 : 1);
