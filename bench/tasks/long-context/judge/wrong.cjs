// The obvious fix: delete the flag from config.cjs but leave the three call sites reading it.
// config.legacyMode is now undefined (falsy), so all three silently take the modern branch —
// today's behaviour changes even though "legacyMode" also still appears in three files.
const fs = require('node:fs');
fs.writeFileSync('config.cjs', 'module.exports = { retries: 3 };\n');
