const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readPrivate } = require('./private-store.cjs');
const { bounded, digest } = require('./session-files.cjs');

const ENVIRONMENT = ['HOME', 'USERPROFILE', 'VIBE_HOME_DIR', 'VIBE_REVIEW_CMD', 'VIBE_REVIEW_CLIENT', 'VIBE_REVIEWER_MODEL', 'VIBE_REVIEWER_EFFORT'];
const fingerprint = value => digest(JSON.stringify(value));
function resolvedDirectory(directory) {
  let existing = path.resolve(directory);
  const suffix = [];
  while (!fs.existsSync(existing)) { suffix.unshift(path.basename(existing)); existing = path.dirname(existing); }
  return path.join(fs.realpathSync(existing), ...suffix);
}
function runtimeMatches(root, plan) {
  const shell = process.platform === 'win32' ? process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe' : '/bin/sh';
  if (plan.project !== fs.realpathSync(root) || plan.platform !== process.platform || plan.shell !== fs.realpathSync(shell) || plan.node !== fs.realpathSync(process.execPath)) return false;
  if (plan.path !== (process.env.PATH ?? '') || plan.pathExt !== (process.env.PATHEXT ?? '')) return false;
  if (!plan.environment || ENVIRONMENT.some(key => plan.environment[key] !== (process.env[key] ?? null))) return false;
  const reviewerCwd = process.env.VIBE_REVIEW_CMD ? root : resolvedDirectory(path.join(process.env.VIBE_HOME_DIR ?? os.homedir(), '.config', 'vibe', 'reader'));
  if (!plan.reviewer || plan.reviewer.cwd !== reviewerCwd) return false;
  return plan.checks.every(item => {
    const expected = item.check.type === 'review' ? reviewerCwd : fs.realpathSync(item.check.type === 'run' && item.check.cwd ? path.resolve(root, item.check.cwd) : root);
    return item.cwd === expected;
  });
}
function verifiersMatch(plan) {
  const seen = new Map();
  const deadline = Date.now() + 1000;
  let bytes = 0;
  for (const item of plan.checks) {
    if (!Array.isArray(item.verifiers) || item.verifiers.length > 512) throw new Error('verifier limit');
    for (const verifier of item.verifiers) {
      if (Date.now() > deadline) throw new Error('verifier limit');
      if (typeof verifier.file !== 'string' || !path.isAbsolute(verifier.file) || !/^[a-f0-9]{64}$/.test(verifier.sha256)) return false;
      if (!seen.has(verifier.file)) {
        if (seen.size >= 512) throw new Error('verifier limit');
        const content = bounded(verifier.file, 1048576);
        bytes += content.length;
        if (bytes > 33554432) throw new Error('verifier limit');
        seen.set(verifier.file, digest(content));
      }
      if (seen.get(verifier.file) !== verifier.sha256) return false;
    }
  }
  return true;
}
function contextStatus(root, plan) {
  try {
    if (!plan || plan.schemaVersion !== 1 || !Array.isArray(plan.checks) || plan.checks.length > 1000) return 'unavailable';
    const receipt = readPrivate(root, `consent-${fingerprint(root)}.json`);
    if (receipt === null) return 'stale';
    const saved = JSON.parse(receipt);
    const expected = fingerprint(plan);
    if (saved.schemaVersion !== 1 || saved.fingerprint !== expected || fingerprint(saved.plan) !== expected) return 'stale';
    return runtimeMatches(root, plan) && verifiersMatch(plan) ? 'fresh' : 'stale';
  } catch { return 'unavailable'; }
}
module.exports = { contextStatus };
