// The reference patch — never shown to either arm. Wires `lines: { max }` through the four places.
const fs = require('node:fs');
const edit = (file, pairs) => {
  let s = fs.readFileSync(file, 'utf-8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${file}: anchor not found: ${a.slice(0, 60)}`);
    s = s.replace(a, b);
  }
  fs.writeFileSync(file, s);
};
edit('src/core/scenarios.ts', [
  ["  /** An evidence file every number in this file must be traceable to. */", "  /** The file may hold at most `max` lines. */\n  lines?: { max: number };\n  /** An evidence file every number in this file must be traceable to. */"],
  ["const hasRule = check['exists'] !== undefined || str(check['pattern']) || str(check['contains']) || str(check['absent']) || str(check['traceable']) || check['a11y'] === true || str(check['schema']) || sum !== undefined;",
   "const lines = check['lines'];\n      if (lines !== undefined && !(isRecord(lines) && Number.isInteger(lines['max']))) return 'file lines requires max (an integer)';\n      const hasRule = check['exists'] !== undefined || str(check['pattern']) || str(check['contains']) || str(check['absent']) || str(check['traceable']) || check['a11y'] === true || str(check['schema']) || sum !== undefined || lines !== undefined;"],
  ["'file check requires one of exists·pattern·contains·absent·traceable·a11y·schema·sum'", "'file check requires one of exists·pattern·contains·absent·traceable·a11y·lines·schema·sum'"],
]);
edit('src/core/checks/file.ts', [
  ["  if (check.schema !== undefined) {\n    const failed = schemaRule(check.schema, content, root, started);",
   "  if (check.lines !== undefined) {\n    const count = content.replace(/\\n$/, '').split('\\n').length;\n    if (count > check.lines.max) return done(false, started, `${count} lines`, `too many lines: ${count} > ${check.lines.max}`);\n  }\n  if (check.schema !== undefined) {\n    const failed = schemaRule(check.schema, content, root, started);"],
]);
edit('README.md', [
  ["/ `schema` / `sum: {column, equals, tolerance}` |", "/ `lines: { max: N }` (at most N lines) / `schema` / `sum: {column, equals, tolerance}` |"],
]);
edit('skills/vibe-scope/SKILL.md', [
  ["/a11y (mechanical accessibility defects)/schema/sum", "/a11y (mechanical accessibility defects)/lines (at most N lines)/schema/sum"],
]);
