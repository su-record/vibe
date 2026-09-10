const fs = require('node:fs');
const path = require('node:path');
const { json, writeJson } = require('../checks/files.cjs');
const { events } = require('../checks/evidence.cjs');
const { priority } = require('./customer.cjs');

function candidate(id, activity, observed) {
  const measured = observed.filter((event) => event.minutes !== null);
  return { id, problem: `Reduce repeated ${activity} while preserving evidence`, countingRule: 'Count each worklog event_id once across exports and references', evidence: [{ path: 'evidence/worklog.csv', eventIds: observed.map(({ id: eventId }) => eventId) }],
    observed: { events: observed.length, measuredEvents: measured.length, activeMinutes: measured.length ? measured.reduce((sum, event) => sum + event.minutes, 0) : null },
    automation: { input: 'local exported evidence', output: 'traceable drafts for human review', tool: 'installed node', installation: 'node automation/install.cjs --target <fixture-directory>' },
    feasibility: { status: 'local-only', prerequisites: [] }, risks: { failureCases: ['missing or invalid input fails visibly'], permissions: ['local files only'], externalEffects: [], humanReview: 'Review drafts before any external send; automatic payment is prohibited', rollback: 'Use the installation manifest to remove only unchanged installed files' },
    estimates: { savingsMinutes: null, roi: null, failureProbability: null, implementationHours: null },
    scenario: { id: `evidence-${id}`, check: { type: 'run', cmd: `node checks/verify.cjs evidence ${id}` } } };
}

function writeScope(workspace, variant, alternative = false) {
  const desired = priority(variant), all = [...events(workspace).values()];
  const mapping = [['status', 'internal status preparation'], ['followup', 'meeting follow-up preparation'], ['invoices', 'invoice matching']];
  const opportunities = mapping.map(([id, activity]) => candidate(alternative ? `candidate-${id}` : id, activity, all.filter((event) => event.activity === activity)));
  opportunities.sort((a, b) => Number(b.id.endsWith(desired.kind)) - Number(a.id.endsWith(desired.kind)));
  const window = json(path.join(workspace, 'evidence/documents/window.json'));
  const register = { schemaVersion: 1, observationWindow: { start: window.start, end: window.end }, sourceCoverage: { available: ['evidence/worklog.csv', 'evidence/mail.jsonl', 'evidence/tables', 'evidence/meetings', 'evidence/documents/policy.md'], missing: [...window.missing] }, opportunities, selected: opportunities[0].id, rankingRationale: 'Prioritize the customer-selected outcome among feasible local pilots; recorded effort does not establish savings or ROI.', customerAnswerRefs: [0] };
  writeJson(path.join(workspace, 'out/opportunities.json'), register);
  const scope = { intent: `# ${desired.kind} local pilot\n\nUse distinct source events and measured preparation time only. Keep missing evidence unknown. Build one customer-selected local draft pilot. Preserve missing owners and due dates, require human review before external effects, fail on invalid input, install reversibly and document rerun/rollback in OPERATOR.md.`, scenarios: [
    ...opportunities.map((item) => ({ id: item.scenario.id, then: `The evidence supports ${item.problem}`, check: item.scenario.check })),
    { id: alternative ? 'replay-and-recovery' : 'selected-pilot', then: 'The chosen local pilot works on changed input and supports failure handling, human review, installation and rollback', check: { type: 'run', cmd: 'node checks/verify.cjs pilot' } },
  ] };
  writeJson(path.join(workspace, 'out/scope.json'), scope);
  return { register, scope };
}

function build(workspace, variant) {
  const kind = priority(variant).kind;
  fs.mkdirSync(path.join(workspace, 'automation'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'automation/run.cjs'), `const KIND = ${JSON.stringify(kind)};\n${fs.readFileSync(path.join(__dirname, 'run-template.cjs'), 'utf8')}`);
  fs.copyFileSync(path.join(__dirname, 'install.cjs'), path.join(workspace, 'automation/install.cjs'));
  fs.writeFileSync(path.join(workspace, 'OPERATOR.md'), '# Local pilot\n\nRun node automation/run.cjs --input evidence --out out/pilot. Review all drafts and missing owner/due fields before any external action.\nInstall with node automation/install.cjs --target <fixture-directory>. Roll back with node automation/install.cjs --target <fixture-directory> --rollback <fixture-directory>/.vibe-pilot-manifest.json. Source evidence stays unchanged.\n');
}

module.exports = { writeScope, build };
