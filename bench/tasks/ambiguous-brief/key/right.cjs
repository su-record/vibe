// One line per changelog entry under a short heading, nothing invented, well under 12 lines.
const fs = require('node:fs');
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync(
  'out/note.md',
  '# 4.2.0\n\n- Fixed a crash when importing large CSV files\n- Added CSV export for settlement reports\n- Reduced startup time by 40%\n- Removed the deprecated --old-format flag\n',
);
