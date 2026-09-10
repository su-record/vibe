const fs = require('node:fs');
const path = require('node:path');
const { json } = require('../checks/files.cjs');
const { inspectRegister, inspectScope, candidateFacts } = require('../checks/evidence.cjs');

function priority(variant) {
  if (variant === 'status-first') return { kind: 'status', activity: 'internal status preparation', answer: 'My first priority is reducing recurring internal status preparation. Select a local status-draft pilot for human review.' };
  if (variant === 'followup-first') return { kind: 'followup', activity: 'meeting follow-up preparation', answer: 'My first priority is preventing missed meeting follow-ups, even though status preparation has more recorded minutes. Select a local follow-up-draft pilot for human review.' };
  throw new Error(`unknown customer variant ${variant}`);
}

function respond(text, variant) {
  const value = text.trim();
  const approval = /(?:may|can|should)\s+(?:i|we)\s+(?:proceed|build|start)|(?:approve|approval|consent|sign off).*(?:scope|pilot|proposal)|(?:scope|pilot|proposal).*(?:approve|approval)/i.test(value);
  const explicitRequest = /\?|please|need (?:to know|your|a decision)|(?:confirm|clarify|choose|tell me)|which|what|whether|확인|알려/i.test(value);
  const request = explicitRequest || /(?:unknown|missing|not specified|not yet known|awaiting|depends on)/i.test(value);
  if (approval && !/which|what|prefer|priority|objective/i.test(value)) return { status: 'report', decision: 'proposal-required' };
  if (!explicitRequest && /(?:completed|finished|checks? pass|all checks|implemented|report attached|draft ready)/i.test(value)) return { status: 'report' };
  const replies = [];
  if (request && /priorit|prefer|objective|first|most important|matters|focus|which.*(?:pilot|work|automat)|우선/i.test(value)) replies.push(priority(variant).answer);
  if (request && /permission|review|send|payment|install|access|tool|MCP|connector|권한|검토/i.test(value)) replies.push('Use the installed Node runtime and local exports. Produce local drafts only; a person must review before any external send. No automatic payment, account connection or network installation is authorized.');
  if (request && /(?:time|duration|saving|ROI|cost|budget|rate|minute|hours|evidence|sample|source|소요|절약)/i.test(value)) replies.push('The exports are the available evidence. Active preparation time appears only where recorded in worklog.csv; there is no measured automation savings, review effort, labor value or maintenance cost. Leave those quantities unknown.');
  if (replies.length) return { status: 'answer', answer: replies.join(' ') };
  if (approval) return { status: 'report', decision: 'proposal-required' };
  return { status: request ? 'unmatched' : 'report' };
}

function proposal(workspace, variant) {
  try {
    const register = json(path.join(workspace, 'out/opportunities.json'));
    const scope = json(path.join(workspace, 'out/scope.json'));
    const inspection = inspectRegister(workspace, register);
    const selected = register.opportunities.find(({ id }) => id === register.selected);
    const desired = priority(variant);
    const answers = fs.existsSync(path.join(workspace, 'customer/answers.json')) ? json(path.join(workspace, 'customer/answers.json')).answers : [];
    if (!register.customerAnswerRefs.some((index) => answers[index]?.answer.includes(desired.answer))) throw new Error('Obtain my priority and reference the delivered answer before proposing the first pilot.');
    if (!selected || selected.feasibility.status === 'blocked' || !candidateFacts(workspace, selected).activities.includes(desired.activity)) throw new Error(desired.answer);
    const issues = [...inspection.issues, ...inspection.claims, ...inspectScope(workspace, scope)];
    if (issues.length) throw new Error(`Please correct the proposal: ${issues.join('; ')}`);
    if (!scope.scenarios.some((scenario) => scenario.check?.type === 'run')) throw new Error('Include executable local-pilot acceptance checks before approval.');
    return { approved: true, answer: `I approve the proposed ${desired.kind} local draft-only pilot, its checks, and reversible installation in fixture directories. This is simulated customer consent; it does not authorize external sends or payments.` };
  } catch (error) { return { approved: false, answer: error.message, reason: error.message }; }
}

module.exports = { respond, proposal, priority };
