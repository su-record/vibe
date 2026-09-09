// Counting "no more than N lines" is not a regex a pattern check can express well; the harness
// runs this instead.
const fs = require('node:fs');
const content = fs.readFileSync('out/note.md', 'utf-8');
const lines = content.replace(/\n$/, '').split('\n');
if (lines.length > 12) {
  console.error(`out/note.md has ${lines.length} lines, limit 12`);
  process.exit(1);
}
console.log(`out/note.md: ${lines.length} line(s)`);
