const fs = require('node:fs');
const path = require('node:path');
const { readPrivate, writePrivate } = require('./private-store.cjs');
const { optional, json, digest, revision, projectFingerprint } = require('./session-files.cjs');
const { repairData, repairMessage } = require('./session-repair.cjs');
const { contextStatus } = require('./session-context.cjs');

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const HASH = /^[a-f0-9]{16,64}$/;
const STATUSES = ['pass', 'fail', 'pending', 'blocked', 'stale', 'handoff'];
const name = (kind, value) => `${kind}-${digest(value)}.json`;
function identity(payload = {}, env = process.env) {
  const ids = [payload.session_id, env.CODEX_THREAD_ID, env.CLAUDE_SESSION_ID].filter(Boolean);
  if (ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9._:-]{1,256}$/.test(id))) throw new Error('session-identity-invalid');
  if (new Set(ids).size > 1) throw new Error('session-identity-conflict');
  if (!ids.length) throw new Error('session-identity-missing');
  return ids[0];
}
function hostRoot(payload = {}, env = process.env, cwd = process.cwd()) {
  const roots = [cwd, payload.cwd, env.CLAUDE_PROJECT_DIR].filter(Boolean);
  if (roots.some(root => typeof root !== 'string' || !path.isAbsolute(root))) throw new Error('session-root-invalid');
  const canonical = roots.map(root => fs.realpathSync(root));
  if (new Set(canonical).size !== 1) throw new Error('session-root-conflict');
  return canonical[0];
}
function bindSession(root, id, scenarios = []) {
  root = fs.realpathSync(root);
  identity({ session_id: id });
  if (scenarios.length > 1000 || scenarios.some(s => !ID.test(s.id) || (s.needs ?? []).some(id => !ID.test(id)))) throw new Error('invalid session scenarios');
  const guard = readPrivate(root, name('guard', id), 4096);
  if (guard !== null) {
    const existing = JSON.parse(guard);
    if (!Number.isInteger(existing.count) || existing.count < 0 || existing.count > 3 || (existing.key !== null && !/^[a-f0-9]{64}$/.test(existing.key))) throw new Error('invalid session guard');
  }
  const binding = { schemaVersion: 1, root, id, revision: revision(root), scenarios: scenarios.map(s => ({ id: s.id, needs: s.needs ?? [] })) };
  writePrivate(root, name('session', id), JSON.stringify(binding));
  if (guard === null) writePrivate(root, name('guard', id), JSON.stringify({ key: null, count: 0 }));
  return { status: 'bound', ...binding };
}
function workflow(root) {
  const questions = new Map(), handed = new Set(), changes = [];
  const inbox = optional(path.join(root, '.vibe/inbox.jsonl')) ?? '';
  for (const line of inbox.split('\n').filter(Boolean)) {
    const e = JSON.parse(line);
    if (typeof e.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(e.id)) continue;
    if (e.type === 'question') questions.set(e.id, false);
    if (e.type === 'answer' || e.type === 'resolve') questions.delete(e.id);
  }
  const state = json(path.join(root, '.vibe/state.json'));
  const ledger = optional(path.join(root, '.vibe/ledger.jsonl'), 2097152) ?? '';
  for (const line of ledger.split('\n').filter(Boolean)) {
    const e = JSON.parse(line), item = e.handoff;
    if (!item || item.intentHash !== state.intentHash || !ID.test(item.scenario)) continue;
    if (e.event === 'handoff') handed.add(item.scenario);
    if (e.event === 'reopen') handed.delete(item.scenario);
    if (e.event === 'handoff' || e.event === 'reopen') changes.push([e.event, item.scenario]);
  }
  return { intentHash: state.intentHash, approvalWaiting: state.state === 'DRAFT', abandoned: state.state === 'ABANDONED', waiting: [...questions.keys()].sort(), handed: [...handed].sort(), changes: digest(JSON.stringify(changes)) };
}
function validEvidence(input) {
  return input && /^r-\d+$/.test(input.run) && HASH.test(input.intentHash) && typeof input.done === 'boolean' &&
    Array.isArray(input.scenarios) && input.scenarios.length <= 1000 &&
    input.scenarios.every(s => s && ID.test(s.id) && STATUSES.includes(s.status)) &&
    new Set(input.scenarios.map(s => s.id)).size === input.scenarios.length &&
    (!input.done || input.scenarios.every(s => s.status === 'pass'));
}
function stopSnapshot(root, plan) {
  let currentRevision = 'unavailable';
  try {
    currentRevision = revision(root);
    const context = contextStatus(root, plan);
    if (context !== 'fresh') return { snapshotStatus: context, failureCode: 'stop-context-unavailable', revision: currentRevision, files: null, workflow: null };
    return { snapshotStatus: 'complete', revision: currentRevision, files: projectFingerprint(root), workflow: workflow(root).changes };
  } catch {
    return { snapshotStatus: 'unavailable', failureCode: 'stop-snapshot-unavailable', revision: currentRevision, files: null, workflow: null };
  }
}
function recordStopEvidence(root, input) {
  root = fs.realpathSync(root);
  if (!validEvidence(input)) throw new Error('invalid Stop evidence');
  const proof = { schemaVersion: 2, root, run: input.run, intentHash: input.intentHash, done: input.done,
    scenarios: input.scenarios, repair: input.repair ?? null, failures: input.failures ?? [], executionPlan: input.executionPlan, ...stopSnapshot(root, input.executionPlan) };
  writePrivate(root, name('proof', root), JSON.stringify(proof));
  return proof;
}
function unavailableStatus(root, binding, proof) {
  let currentRevision = 'unavailable';
  try { currentRevision = revision(root); } catch { /* Only fixed diagnostic text leaves the hook. */ }
  return { root, revision: currentRevision, intent: proof.intentHash, complete: false, fresh: false, snapshotStatus: 'unavailable',
    remaining: proof.scenarios.map(s => s.id), repair: repairData(proof.repair), failures: proof.failures ?? [], waiting: [], handed: [], graph: binding.scenarios };
}
function structuralStatus(root, binding) {
  const raw = readPrivate(root, name('proof', root));
  const proof = raw === null ? null : JSON.parse(raw);
  if (proof && (proof.schemaVersion !== 2 || proof.root !== root || !validEvidence(proof))) throw new Error('invalid private proof');
  if (proof && proof.snapshotStatus !== 'complete') return unavailableStatus(root, binding, proof);
  if (proof && contextStatus(root, proof.executionPlan) !== 'fresh') return unavailableStatus(root, binding, proof);
  const flow = workflow(root);
  const currentRevision = revision(root);
  const scenarios = proof?.scenarios ?? binding.scenarios;
  if (scenarios.length > 1000 || scenarios.some(s => !ID.test(s.id))) throw new Error('invalid private scenarios');
  const filesFresh = Boolean(proof && proof.intentHash === flow.intentHash && proof.revision === currentRevision && proof.files === projectFingerprint(root));
  const fresh = Boolean(filesFresh && proof.workflow === flow.changes);
  const complete = Boolean(fresh && proof.done && proof.scenarios.length && proof.scenarios.every(s => s.status === 'pass') && !flow.waiting.length && !flow.handed.length && !flow.approvalWaiting && !flow.abandoned);
  const remaining = complete ? [] : scenarios.filter(s => !filesFresh || s.status !== 'pass' || flow.handed.includes(s.id)).map(s => s.id);
  const hash = proof?.intentHash ?? 'unverified';
  return { root, revision: currentRevision, intent: hash, complete, fresh, approvalWaiting: flow.approvalWaiting, abandoned: flow.abandoned, waiting: flow.waiting, handed: flow.handed, graph: binding.scenarios,
    remaining, repair: repairData(proof?.repair), failures: proof?.failures ?? [], progress: digest(JSON.stringify({ statuses: proof?.scenarios?.map(s => [s.id, s.status]).sort() ?? [] })) };
}
function sessionStatus(payload = {}, env = process.env, cwd = process.cwd()) {
  let root;
  try {
    root = hostRoot(payload, env, cwd);
    const id = identity(payload, env);
    const raw = readPrivate(root, name('session', id), 131072);
    if (!raw) return { status: 'session-unbound', root, revision: revision(root) };
    const binding = JSON.parse(raw);
    if (binding.schemaVersion !== 1 || binding.id !== id || !Array.isArray(binding.scenarios) || binding.scenarios.length > 1000 ||
      binding.scenarios.some(s => !s || !ID.test(s.id) || !Array.isArray(s.needs) || s.needs.length > 1000 || s.needs.some(n => !ID.test(n)))) throw new Error('session-unavailable');
    if (binding.root !== root) return { status: 'session-root-mismatch', root, revision: revision(root) };
    return { status: 'bound', id, ...structuralStatus(root, binding) };
  } catch (error) {
    const allowed = ['session-identity-invalid', 'session-identity-conflict', 'session-identity-missing', 'session-root-invalid', 'session-root-conflict'];
    return { status: allowed.includes(error.message) ? error.message : 'session-unavailable', root: root ?? null, revision: 'unavailable' };
  }
}
function message(view, status) {
  const root = view.root ? encodeURIComponent(view.root).slice(0, 600) : 'unavailable';
  const ids = (view.remaining ?? []).slice(0, 12).map(id => `${view.intent}/${id}`).join(',') || 'unresolved';
  const questions = (view.waiting ?? []).filter(id => /^[a-zA-Z0-9-]{1,80}$/.test(id)).slice(0, 12);
  return `[vibe] ${status}; root=${root}; revision=${view.revision}; scenarios=${ids}${questions.length ? `; questions=${questions.join(',')}` : ''}. Stop ran no checks.${repairMessage(view)}`;
}
function allHanded(view) {
  if (!view.handed.length || !view.remaining.length) return false;
  const covered = new Set(view.handed);
  let changed;
  do {
    changed = false;
    for (const s of view.graph) if (!covered.has(s.id) && s.needs.some(id => covered.has(id))) { covered.add(s.id); changed = true; }
  } while (changed);
  return view.remaining.every(id => covered.has(id));
}
function stopDecision(payload = {}, env = process.env, cwd = process.cwd()) {
  const view = sessionStatus(payload, env, cwd);
  if (view.status !== 'bound') return { systemMessage: message(view, `${view.status}; unmet; use explicit vibe session bind in the intended worktree`) };
  if (view.snapshotStatus === 'unavailable') return { systemMessage: message(view, 'explicit-check snapshot unavailable; unmet') };
  if (view.complete) return { systemMessage: message(view, 'verified completion from an explicit check') };
  if (view.approvalWaiting) return { systemMessage: message(view, 'waiting for approval; unmet') };
  if (view.abandoned) return { systemMessage: message(view, 'intent abandoned; unmet') };
  if (view.waiting.length) return { systemMessage: message(view, 'waiting for an answer; unmet') };
  if (allHanded(view)) return { systemMessage: message(view, 'required work is in handoff; unmet') };
  try {
    const raw = readPrivate(view.root, name('guard', view.id), 4096);
    const old = raw ? JSON.parse(raw) : {};
    const count = old.key === view.progress && Number.isInteger(old.count) && old.count >= 0 && old.count <= 3 ? Math.min(old.count + 1, 3) : 1;
    writePrivate(view.root, name('guard', view.id), JSON.stringify({ key: view.progress, count }));
    const reason = message(view, count > 2 ? 'same-state retry limit reached; unmet' : 'work remains unmet; build then explicitly run vibe check');
    return count > 2 ? { systemMessage: reason } : { decision: 'block', reason };
  } catch { return { systemMessage: message(view, 'session guard unavailable; unmet') }; }
}
module.exports = { identity, hostRoot, bindSession, recordStopEvidence, sessionStatus, stopDecision, message };
