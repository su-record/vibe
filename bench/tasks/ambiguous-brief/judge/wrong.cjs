// The obvious over-reading: a long, friendly announcement with an invented figure (50% instead
// of the changelog's 40%) and a leftover placeholder.
const fs = require('node:fs');
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync(
  'out/note.md',
  "# We're excited to announce version 4.2.0!\n\nThank you for being a valued user of our product. This release brings a number of exciting\nimprovements that we think you'll love.\n\n## Highlights\n\n- Fixed a crash when importing large CSV files, making the app much more stable overall\n- Added CSV export for settlement reports so you can share data with your team\n- Reduced startup time by 50%, our fastest release yet\n- Removed the deprecated --old-format flag\n\n## Coming soon\n\n[TODO: add roadmap link]\n\nAs always, thank you for your support!\n",
);
