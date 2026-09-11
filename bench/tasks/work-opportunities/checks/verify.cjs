const path = require('node:path');
const { json } = require('./files.cjs');
const { inspectRegister, inspectScope, candidateFacts } = require('./evidence.cjs');
const { exercisePilot } = require('./pilot.cjs');

try {
  const root = process.cwd(), register = json(path.join(root, 'out/opportunities.json'));
  const inspected = inspectRegister(root, register);
  if (inspected.issues.length || inspected.claims.length) throw new Error([...inspected.issues, ...inspected.claims].join('; '));
  if (process.argv[2] === 'evidence') {
    const candidate = register.opportunities.find(({ id }) => id === process.argv[3]);
    if (!candidate) throw new Error('evidence check requires an existing candidate id');
    if (candidateFacts(root, candidate).events < 2) throw new Error('candidate does not establish recurring work');
  } else if (process.argv[2] === 'pilot') {
    const selected = register.opportunities.find(({ id }) => id === register.selected);
    if (!selected || selected.feasibility.status === 'blocked') throw new Error('select an eligible agreed local pilot before building');
    const activity = candidateFacts(root, selected).activities[0];
    const kind = activity === 'internal status preparation' ? 'status' : activity === 'meeting follow-up preparation' ? 'followup' : null;
    if (!kind) throw new Error('the selected pilot needs a publicly agreed output adapter');
    const result = exercisePilot(root, kind);
    if (result.failures.length) throw new Error(result.failures.join('; '));
  } else {
    const issues = inspectScope(root, json(path.join(root, 'out/scope.json')));
    if (issues.length) throw new Error(issues.join('; '));
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
