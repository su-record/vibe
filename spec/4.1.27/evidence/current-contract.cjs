// Harmless characterization in disposable homes/projects; no imported check is executed.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const cli = '/home/ubuntu/sutory/work/vibe-fde-20260910/repo/dist/cli.js';
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-trust-observation-'));
const home = path.join(temporary, 'home'); fs.mkdirSync(home);
const env = { ...process.env, HOME: home, USERPROFILE: home, VIBE_HOME_DIR: home, VIBE_SKIP_SETUP: '1', VIBE_NO_PLUGIN: '1', VIBE_NO_INSTALL: '1' };
const call = (cwd, args, input) => {
  const r = spawnSync(process.execPath, [cli, ...args, '--json'], { cwd, env, input, encoding: 'utf8', timeout: 30000 });
  if (r.status !== 0) throw new Error(`${args.join(' ')}: ${r.status} ${r.stderr || r.stdout}`);
  return JSON.parse(r.stdout);
};
try {
  const a = path.join(temporary, 'a'), b = path.join(temporary, 'b');
  for (const project of [a, b]) {
    fs.mkdirSync(project);
    const git = spawnSync('git', ['init', '-q'], { cwd: project, env, encoding: 'utf8' });
    assert.equal(git.status, 0, git.stderr);
    fs.writeFileSync(path.join(project, 'marker.cjs'), "require('node:fs').writeFileSync('ran.txt','local fixture only'); console.log('SYNTHETIC_OUTPUT_CANARY_427');\n");
  }
  call(a, ['tokens', 'off']);
  call(a, ['intent', 'draft', '--stdin'], JSON.stringify({ intent: '# Fixture-only execution observation\n\nObserve a local marker command.', scenarios: '- id: marker\n  then: A fixture-local marker records execution.\n  check: { type: run, cmd: "node marker.cjs" }\n' }));
  call(a, ['approve']); // Simulated fixture consent, never the product/release approval.
  fs.cpSync(path.join(a, '.vibe'), path.join(b, '.vibe'), { recursive: true });
  const before = call(b, ['state']);
  assert.equal(fs.existsSync(path.join(b, 'ran.txt')), false, 'state unexpectedly executed a check');
  const result = call(b, ['check', '--all']);
  const evidence = fs.readFileSync(path.join(b, '.vibe/evidence', result.run + '.json'), 'utf8');
  const abandoned = call(b, ['abandon', '--reason', 'Fixture observation complete; this is not a release decision.']);
  const state = JSON.parse(fs.readFileSync(path.join(b, '.vibe/state.json'), 'utf8'));
  const events = fs.readFileSync(path.join(b, '.vibe/ledger.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const observed = {
    candidateRevision: '96e4ea7a9671f3cc8d3021b47affd61d75cff62d',
    kind: 'current-behavior-characterization', releaseAcceptance: false, paidCohortCalls: 0,
    copiedApproval: { displayedState: before.state, executedWithoutDestinationApproval: fs.existsSync(path.join(b, 'ran.txt')), checkExitWasZero: result.failed === 0 },
    outputPersistence: { syntheticSuccessCanaryInEvidence: evidence.includes('SYNTHETIC_OUTPUT_CANARY_427') },
    existingAbandon: { cliState: abandoned.state, state: state.state, reasonRetained: Boolean(state.abandonedReason), ledgerEvent: events.at(-1).event, lastResultNotCleared: fs.existsSync(path.join(b, '.vibe/results.json')) },
  };
  assert.equal(observed.copiedApproval.executedWithoutDestinationApproval, true);
  assert.equal(observed.outputPersistence.syntheticSuccessCanaryInEvidence, true);
  assert.equal(observed.existingAbandon.state, 'ABANDONED');
  assert.equal(observed.existingAbandon.ledgerEvent, 'abandon');
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(observed, null, 2) + '\n');
  console.log('Three current-behavior observations recorded: copied local approval, success-output persistence, existing intent abandonment. These are diagnostic facts, not a safety pass.');
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
