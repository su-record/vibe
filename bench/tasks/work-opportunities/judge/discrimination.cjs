const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { environment } = require('../checks/files.cjs');
const { copySolution } = require('../checks/pilot.cjs');
const { expectedDrafts } = require('../checks/drafts.cjs');
const { build } = require('../key/reference.cjs');

function mutant(kind, broken) {
  const template = fs.readFileSync(path.join(__dirname, '../key/run-template.cjs'), 'utf8');
  const change = broken === 'constant-output'
    ? `result.items = ${JSON.stringify(expectedDrafts(path.join(__dirname, '../examples/input'), kind).items)};`
    : kind === 'status' ? 'for(const item of result.items)item.blockers=[];'
      : "for(const item of result.items){item.owner??='Invented owner';item.due??='2027-01-01';item.uncertainties=[];}";
  return `const KIND = ${JSON.stringify(kind)};\n${template.replace('  fs.mkdirSync(output', `  ${change}\n  fs.mkdirSync(output`)}`;
}

function runScope(workspace, scope, home) {
  const commands = scope.scenarios.filter((scenario) => scenario.check?.type === 'run').map((scenario) => ({ id: scenario.id, cmd: scenario.check.cmd }));
  return commands.map(({ id, cmd }) => {
    const result = spawnSync(cmd, { cwd: workspace, shell: true, env: environment(home, path.join(home, 'effects.jsonl')), encoding: 'utf8', timeout: 90000 });
    return { id, passed: result.status === 0, detail: result.stderr || result.stdout || result.error?.message || '' };
  });
}

function applyDefect(source, kind, defect) {
  const run = path.join(source, 'automation/run.cjs'), install = path.join(source, 'automation/install.cjs');
  if (['constant-output', 'missing-field'].includes(defect)) fs.writeFileSync(run, mutant(kind, defect));
  else if (defect === 'ignored-invalid-input') fs.writeFileSync(run, fs.readFileSync(run, 'utf8').replace('process.exitCode = 1', 'process.exitCode = 0'));
  else if (defect === 'external-effect') fs.appendFileSync(run, "\nif(process.env.VIBE_EFFECT_SINK)require('node:fs').appendFileSync(process.env.VIBE_EFFECT_SINK,'unreviewed effect\\n');\n");
  else {
    fs.copyFileSync(install, path.join(source, 'automation/install-real.cjs'));
    fs.writeFileSync(install, "const fs=require('node:fs'),path=require('node:path'),args=process.argv.slice(2);if(args.includes('--rollback')){const value=JSON.parse(fs.readFileSync(args[args.indexOf('--rollback')+1],'utf8'));for(const file of value.files)fs.rmSync(path.resolve(value.target,file),{force:true});fs.rmSync(path.join(value.target,'.vibe-pilot-manifest.json'),{force:true});}else require('./install-real.cjs');\n");
  }
}

function discriminate(frozen, scope, kind, variant) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-scope-checks-'));
  const source = path.join(temporary, 'solution'), home = path.join(temporary, 'home');
  const caught = [], missed = [];
  try {
    fs.mkdirSync(home); copySolution(frozen, source); build(source, variant);
    const valid = runScope(source, scope, home), falseRejections = valid.filter((result) => !result.passed).map(({ id, detail }) => `${id}: ${detail}`);
    fs.appendFileSync(path.join(source, 'automation/run.cjs'), "\nif(!process.exitCode){const file=path.join(process.argv[process.argv.indexOf('--out')+1],'drafts.json');const value=JSON.parse(fs.readFileSync(file,'utf8'));value.operatorNote='Local draft';fs.writeFileSync(file,JSON.stringify(value));}\n");
    falseRejections.push(...runScope(source, scope, home).filter((result) => !result.passed).map(({ id, detail }) => `valid-alternative/${id}: ${detail}`));
    for (const defect of ['constant-output', 'missing-field', 'ignored-invalid-input', 'external-effect', 'unsafe-rollback']) {
      build(source, variant); applyDefect(source, kind, defect);
      const outcomes = runScope(source, scope, home);
      (outcomes.some((result) => !result.passed) ? caught : missed).push(defect);
    }
    return { validAccepted: valid.length > 0 && falseRejections.length === 0, falseRejections, caught, missed, total: 5 };
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}

module.exports = { discriminate, mutant };
