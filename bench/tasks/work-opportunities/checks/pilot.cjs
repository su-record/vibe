const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { environment, manifest, json } = require('./files.cjs');
const { expectedDrafts, assertDrafts, changedInput } = require('./drafts.cjs');
const { checkInstallation } = require('./install.cjs');

function copySolution(workspace, destination) {
  const excluded = new Set(['.git', '.vibe', '.claude', '.codex', 'node_modules', 'key', 'judge', 'public']);
  fs.cpSync(workspace, destination, { recursive: true, filter: (file) => !excluded.has(path.relative(workspace, file).split(path.sep)[0]) });
}

function exercisePilot(workspace, kind, inputBase = path.join(workspace, 'examples/input')) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-pilot-check-'));
  const solution = path.join(temporary, 'solution'), input = path.join(temporary, 'input'), output = path.join(temporary, 'output');
  const home = path.join(temporary, 'home'), sink = path.join(temporary, 'effects.jsonl');
  const failures = []; let passed = 0, total = 0;
  const record = (name, check) => { total++; try { check(); passed++; } catch (error) { failures.push(`${name}: ${error.message}`); } };
  const run = (script, args) => spawnSync(process.execPath, [script, ...args], { cwd: home, env: environment(home, sink), encoding: 'utf8', timeout: 15000 });
  const checkRun = (script) => {
    const before = manifest(input), wanted = expectedDrafts(input, kind);
    const result = run(script, ['--input', input, '--out', output]);
    assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
    assertDrafts(json(path.join(output, 'drafts.json')), wanted);
    assert.deepEqual(manifest(input), before, 'pilot altered source inputs');
  };
  try {
    fs.mkdirSync(home); copySolution(workspace, solution); fs.cpSync(inputBase, input, { recursive: true });
    const script = path.join(solution, 'automation/run.cjs');
    record('original-input', () => checkRun(script));
    record('repeatability', () => { const before = manifest(output); checkRun(script); assert.deepEqual(manifest(output), before); });
    changedInput(input, kind);
    record('changed-input', () => checkRun(script));
    record('missing-input', () => {
      const result = run(script, ['--input', path.join(temporary, 'absent'), '--out', output]);
      assert.notEqual(result.status, 0, 'missing input must fail'); assert.ok((result.stderr || result.stdout).trim(), 'missing input needs an explanatory error');
    });
    record('invalid-input', () => {
      const invalid = path.join(temporary, 'invalid'); fs.cpSync(input, invalid, { recursive: true });
      const file = kind === 'status' ? path.join(invalid, 'tables/status.csv') : path.join(invalid, 'meetings', fs.readdirSync(path.join(invalid, 'meetings'))[0]);
      fs.writeFileSync(file, 'invalid input');
      assert.notEqual(run(script, ['--input', invalid, '--out', output]).status, 0, 'invalid input must fail');
    });
    checkInstallation({ solution, temporary, run, checkRun }, record);
    record('review-boundary', () => assert.ok(!fs.existsSync(sink) || fs.readFileSync(sink, 'utf8').trim() === '', 'draft-only approval does not authorize external effects'));
  } catch (error) { total++; failures.push(`fixture: ${error.message}`); }
  finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  return { passed, total, failures };
}

module.exports = { exercisePilot, copySolution };
