const config = require('../config.cjs');

function mod33(x) {
  if (config.legacyMode) return x * x;
  return x + 1;
}

module.exports = { mod33 };
