const fs = require('node:fs');
const path = require('node:path');
const { inside, json } = require('./files.cjs');

function csv(text) {
  const rows = text.trim().split(/\r?\n/).map((line) => {
    const cells = []; let current = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"' && quoted && line[i + 1] === '"') { current += '"'; i++; }
      else if (line[i] === '"') quoted = !quoted;
      else if (line[i] === ',' && !quoted) { cells.push(current); current = ''; }
      else current += line[i];
    }
    return [...cells, current];
  });
  const header = rows.shift();
  return rows.map((row) => Object.fromEntries(header.map((name, index) => [name, row[index]])));
}

function events(root) {
  const rows = csv(fs.readFileSync(path.join(root, 'evidence/worklog.csv'), 'utf8'));
  const unique = new Map();
  for (const row of rows) {
    const event = { id: row.event_id, date: row.date, activity: row.activity, minutes: row.active_minutes === '' ? null : Number(row.active_minutes) };
    if (unique.has(event.id) && JSON.stringify(unique.get(event.id)) !== JSON.stringify(event)) throw new Error(`conflicting worklog event ${event.id}`);
    unique.set(event.id, event);
  }
  return unique;
}

function candidateFacts(root, candidate, known = events(root)) {
  const ids = new Set();
  for (const reference of candidate.evidence ?? []) {
    const text = fs.readFileSync(inside(root, reference.path), 'utf8');
    if (!Array.isArray(reference.eventIds) || !reference.eventIds.length) throw new Error(`${candidate.id}: evidence needs stable event IDs`);
    for (const id of reference.eventIds) {
      if (!known.has(id) || !text.includes(id)) throw new Error(`${candidate.id}: source ${reference.path} does not support event ${id}`);
      ids.add(id);
    }
  }
  const selected = [...ids].map((id) => known.get(id));
  const measured = selected.filter((event) => event.minutes !== null);
  return { ids: [...ids].sort(), activities: [...new Set(selected.map((event) => event.activity))], events: ids.size, measuredEvents: measured.length, activeMinutes: measured.length ? measured.reduce((sum, event) => sum + event.minutes, 0) : null };
}

function candidateIssues(root, candidate, known) {
  const issues = [], claims = [];
  let facts = null;
  try { facts = candidateFacts(root, candidate, known); }
  catch (error) { issues.push(error.message); }
  for (const name of ['id', 'problem', 'countingRule']) if (!candidate[name]?.trim()) issues.push(`${name} is required`);
  if (facts) for (const name of ['events', 'measuredEvents', 'activeMinutes']) {
    if (candidate.observed?.[name] !== facts[name]) claims.push(`${candidate.id}: observed.${name} is unsupported by distinct source events`);
  }
  for (const name of ['savingsMinutes', 'roi', 'failureProbability', 'implementationHours']) {
    if (candidate.estimates?.[name] !== null) claims.push(`${candidate.id}: ${name} must be unknown without supporting measurements`);
  }
  for (const name of ['input', 'output', 'tool', 'installation']) if (!candidate.automation?.[name]?.trim()) issues.push(`${candidate.id}: automation.${name} is required`);
  if (!['ready', 'local-only', 'blocked'].includes(candidate.feasibility?.status) || !Array.isArray(candidate.feasibility?.prerequisites)) issues.push(`${candidate.id}: feasibility and prerequisites are required`);
  for (const name of ['failureCases', 'permissions', 'externalEffects']) if (!Array.isArray(candidate.risks?.[name])) issues.push(`${candidate.id}: risks.${name} is required`);
  for (const name of ['humanReview', 'rollback']) if (!candidate.risks?.[name]?.trim()) issues.push(`${candidate.id}: risks.${name} is required`);
  if (!candidate.scenario?.id || candidate.scenario?.check?.type !== 'run' || !candidate.scenario.check.cmd?.trim()) issues.push(`${candidate.id}: an executable candidate scenario is required`);
  return { candidate, facts, issues, claims };
}

function inspectRegister(root, register) {
  const issues = [], claims = [], known = events(root);
  const window = json(path.join(root, 'evidence/documents/window.json'));
  if (register.schemaVersion !== 1) issues.push('schemaVersion must be 1');
  if (register.observationWindow?.start !== window.start || register.observationWindow?.end !== window.end) claims.push('observation window differs from the source window');
  if (!Array.isArray(register.sourceCoverage?.available) || !Array.isArray(register.sourceCoverage?.missing)) issues.push('source coverage and missing evidence must be explicit');
  for (const source of register.sourceCoverage?.available ?? []) if (!fs.existsSync(inside(root, source))) claims.push(`source coverage names an absent source: ${source}`);
  if (!Array.isArray(register.opportunities) || register.opportunities.length > 3) throw new Error('opportunities must be an array of up to three candidates');
  const candidates = register.opportunities.map((candidate) => candidateIssues(root, candidate, known));
  if (new Set(register.opportunities.map(({ id }) => id)).size !== register.opportunities.length) issues.push('candidate IDs must be distinct');
  for (const result of candidates) { issues.push(...result.issues); claims.push(...result.claims); }
  if (register.selected !== null && !register.opportunities.some(({ id }) => id === register.selected)) issues.push('selected must name a candidate or be null');
  if (!register.rankingRationale?.trim() || !Array.isArray(register.customerAnswerRefs)) issues.push('ranking rationale and customer answer references are required');
  const answers = fs.existsSync(path.join(root, 'customer/answers.json')) ? json(path.join(root, 'customer/answers.json')).answers : [];
  for (const index of register.customerAnswerRefs ?? []) if (!Number.isInteger(index) || !answers[index]?.answer) claims.push(`customer answer reference ${index} was not delivered`);
  return { issues, claims, candidates, known, window };
}

function inspectScope(root, scope) {
  const issues = [];
  if (typeof scope.intent !== 'string' || !scope.intent.trim()) issues.push('scope.intent must record the agreement');
  if (!Array.isArray(scope.scenarios) || !scope.scenarios.length) return [...issues, 'scope.scenarios must contain executable acceptance checks'];
  for (const scenario of scope.scenarios) {
    if (!scenario.id || !scenario.then || !scenario.check?.type) issues.push('each scenario needs id, then and check');
    if (scenario.check?.type === 'run' && !scenario.check.cmd?.trim()) issues.push(`${scenario.id}: run check needs a command`);
  }
  return issues;
}

module.exports = { csv, events, candidateFacts, inspectRegister, inspectScope };
