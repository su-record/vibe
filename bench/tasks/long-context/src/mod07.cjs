const config = require('../config.cjs');

function mod07(x) {
  if (config.legacyMode) return x * 2;
  return x + 100;
}

module.exports = { mod07 };
