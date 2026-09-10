const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { privateDirectory, readPrivate, writePrivate } = require('./private-store.cjs');
const { digest, json } = require('./session-files.cjs');

const prefix = root => `slice-${digest(root)}-`;
const markerName = root => `slice-counts-${digest(root)}.json`;
function explicitHome(env) {
  if (env === undefined) return undefined;
  const home = process.platform === 'win32' ? env.USERPROFILE : env.HOME;
  if (typeof home !== 'string' || !path.isAbsolute(home)) throw new Error('fixture home required');
  return home;
}
function recordReadTargets(root, input, env) {
  try {
    root = fs.realpathSync(root);
    if (!input || !/^[a-f0-9]{16,64}$/.test(input.intentHash) || !Array.isArray(input.files) || input.files.length > 2048 || input.files.some(file => typeof file !== 'string' || file.length >= 4096)) return false;
    const files = [...new Set(input.files.map(file => path.resolve(root, file)))];
    const body = JSON.stringify({ schemaVersion: 1, root, intentHash: input.intentHash, files });
    if (Buffer.byteLength(body) > 131072) return false;
    writePrivate(root, `read-targets-${digest(root)}.json`, body, explicitHome(env));
    return true;
  } catch { return false; }
}
function readTargets(root) {
  try {
    const raw = readPrivate(root, `read-targets-${digest(root)}.json`, 131072);
    if (raw === null) return { available: false, files: [] };
    const saved = JSON.parse(raw), state = json(path.join(root, '.vibe/state.json'));
    if (saved.schemaVersion !== 1 || saved.root !== root || saved.intentHash !== state.intentHash || !Array.isArray(saved.files) || saved.files.length > 2048 || saved.files.some(file => typeof file !== 'string' || !path.isAbsolute(file))) return { available: false, files: [] };
    return { available: true, files: saved.files };
  } catch { return { available: false, files: [] }; }
}
function recordSlice(root, decision) {
  try {
    if (!['block', 'warn'].includes(decision)) return false;
    if (!initializeSliceCounts(root)) return false;
    const counts = { blocked: Number(decision === 'block'), warned: Number(decision === 'warn') };
    writePrivate(root, `${prefix(root)}${randomBytes(12).toString('hex')}.json`, JSON.stringify(counts));
    return true;
  } catch { return false; }
}
function initializeSliceCounts(root, env) {
  try {
    root = fs.realpathSync(root);
    const home = explicitHome(env);
    const raw = readPrivate(root, markerName(root), 4096, home);
    if (raw !== null) { const value = JSON.parse(raw); return value.schemaVersion === 1 && value.root === root; }
    writePrivate(root, markerName(root), JSON.stringify({ schemaVersion: 1, root }), home);
    return true;
  } catch { return false; }
}
function readSliceCounts(root, env) {
  try {
    root = fs.realpathSync(root);
    const home = explicitHome(env);
    const marker = JSON.parse(readPrivate(root, markerName(root), 4096, home));
    if (!marker || marker.schemaVersion !== 1 || marker.root !== root) return null;
    const directory = privateDirectory(root, false, home);
    const files = fs.readdirSync(directory);
    if (files.length > 32768) return null;
    const counts = { blocked: 0, warned: 0 };
    for (const file of files.filter(file => file.startsWith(prefix(root)))) {
      const value = JSON.parse(readPrivate(root, file, 128, home));
      if (!((value.blocked === 1 && value.warned === 0) || (value.blocked === 0 && value.warned === 1))) return null;
      counts.blocked += value.blocked; counts.warned += value.warned;
    }
    return counts;
  } catch { return null; }
}
module.exports = { recordReadTargets, readTargets, recordSlice, initializeSliceCounts, readSliceCounts };
