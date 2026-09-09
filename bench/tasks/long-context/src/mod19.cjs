const config = require('../config.cjs');

function mod19(x) {
  if (config.legacyMode) return x - 1;
  return -x;
}

module.exports = { mod19 };
