const fs = require('node:fs');
const path = require('node:path');
const { json, writeJson } = require('../checks/files.cjs');
const { expectedDrafts } = require('../checks/drafts.cjs');
const { mutant } = require('../judge/discrimination.cjs');

function breakScope(workspace, defect) {
  const file = path.join(workspace, 'out/opportunities.json'), register = json(file);
  const find = (word) => register.opportunities.find((candidate) => candidate.id.endsWith(word));
  if (defect === 'duplicate-count') find('status').observed.events++;
  else if (defect === 'invented-missing-time') Object.assign(find('invoices').observed, { measuredEvents: 6, activeMinutes: 45 });
  else if (defect === 'meeting-duration') find('followup').observed.activeMinutes = 225;
  else if (defect === 'unsupported-roi') find('status').estimates.roi = 4;
  else if (defect === 'wrong-priority') register.selected = register.selected.endsWith('status') ? find('followup').id : find('status').id;
  else if (defect === 'vacuous-checks') {
    const scopeFile = path.join(workspace, 'out/scope.json'), scope = json(scopeFile);
    scope.scenarios = [{ id: 'always-success', then: 'the pilot is verified', check: { type: 'run', cmd: 'node -e 0' } }];
    writeJson(scopeFile, scope);
  } else throw new Error(`unknown scope defect ${defect}`);
  writeJson(file, register);
}

function breakPilot(workspace, defect, kind) {
  const file = path.join(workspace, 'automation/run.cjs');
  if (defect === 'invented-owner-date') fs.writeFileSync(file, mutant(kind, 'missing-field'));
  else if (defect === 'hard-coded-output') {
    const output = expectedDrafts(path.join(workspace, 'evidence'), kind);
    fs.writeFileSync(file, `const fs=require('node:fs'),path=require('node:path'),args=process.argv.slice(2),out=args[args.indexOf('--out')+1];fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'drafts.json'),${JSON.stringify(JSON.stringify(output))});\n`);
  } else if (defect === 'external-effect') fs.appendFileSync(file, "\nif(process.env.VIBE_EFFECT_SINK)require('node:fs').appendFileSync(process.env.VIBE_EFFECT_SINK,JSON.stringify({action:'send',reviewed:false})+'\\n');\n");
  else if (defect === 'source-damage') fs.appendFileSync(path.join(workspace, 'evidence/documents/policy.md'), '\nChanged during implementation.\n');
  else if (defect === 'missing-handoff') fs.rmSync(path.join(workspace, 'OPERATOR.md'));
  else throw new Error(`unknown pilot defect ${defect}`);
}

module.exports = { breakScope, breakPilot };
