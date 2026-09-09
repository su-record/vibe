// The first session's partial work, never continued: add and list exist, total and export do not.
const fs = require('node:fs');
fs.writeFileSync('ledger.cjs', fs.readFileSync('judge/ledger.cjs', 'utf-8').replace(/\n  case 'total':[\s\S]*?\n  case 'export'/, "\n  case 'export'").replace(/\n  case 'export':[\s\S]*?break;\n/, '\n'));
