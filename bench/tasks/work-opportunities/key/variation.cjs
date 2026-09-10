const path = require('node:path');
const fs = require('node:fs');
const { writeJson } = require('../checks/files.cjs');
const heldOut = require('./heldout-input.json');

function freshInput(directory) {
  fs.mkdirSync(path.join(directory, 'tables'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'tables/status.csv'), heldOut.statusCsv);
  writeJson(path.join(directory, 'meetings/new-notes.json'), heldOut.meeting);
}

module.exports = { freshInput };
