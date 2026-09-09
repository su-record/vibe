// Remove the flag from config.cjs and drop the conditional in the three modules that read it,
// hardcoding the legacy branch — today's behaviour is preserved exactly.
const fs = require('node:fs');
fs.writeFileSync('config.cjs', 'module.exports = { retries: 3 };\n');
fs.writeFileSync('src/mod07.cjs', 'function mod07(x) {\n  return x * 2;\n}\n\nmodule.exports = { mod07 };\n');
fs.writeFileSync('src/mod19.cjs', 'function mod19(x) {\n  return x - 1;\n}\n\nmodule.exports = { mod19 };\n');
fs.writeFileSync('src/mod33.cjs', 'function mod33(x) {\n  return x * x;\n}\n\nmodule.exports = { mod33 };\n');
