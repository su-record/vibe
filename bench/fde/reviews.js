import fs from 'node:fs';
import path from 'node:path';
import { digest } from './evidence.js';

export function packetId(row) {
  return digest({ protocol: row.protocolHash, attempt: row.id, scopes: row.scopeSnapshots?.map((s) => s.hash) ?? [] });
}

/** Separate reviewer packets contain neutral artifacts and customer replies, never arm/usage metadata. */
export function writePackets(rows, output) {
  fs.mkdirSync(output, { recursive: true });
  const index = [];
  for (const row of rows.filter((entry) => entry.event === 'attempt' && entry.scopeSnapshots?.length)) {
    const id = packetId(row);
    const directory = path.join(output, id);
    if (fs.existsSync(directory)) throw new Error(`packet already exists: ${id}`);
    fs.mkdirSync(directory);
    row.scopeSnapshots.forEach((snapshot, number) => {
      const source = path.join(snapshot.path, 'files');
      for (const name of Object.keys(snapshot.manifest)) {
        if (!/^(out\/|checks\/|evidence\/|customer\/)/.test(name)) continue;
        const destination = path.join(directory, `scope-${number + 1}`, name);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(path.join(source, name), destination);
      }
    });
    const handoff = row.events?.filter((entry) => entry.phase === 'handoff').map((entry) => entry.text).join('\n\n') ?? '';
    fs.writeFileSync(path.join(directory, 'handoff.txt'), handoff);
    const metadata = { packet: id, scopeHash: row.scopeSnapshots[0].hash, doubleReview: row.doubleReview };
    fs.writeFileSync(path.join(directory, 'packet.json'), `${JSON.stringify(metadata, null, 2)}\n`);
    index.push(metadata);
  }
  fs.writeFileSync(path.join(output, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, { flag: 'wx' });
  return index;
}

function validRating(rating, packet, requirements) {
  if (rating.kind !== 'human' || rating.packet !== packet || !rating.reviewer || !rating.at || !rating.reason) return false;
  const entries = rating.requirements ?? [];
  return entries.length === requirements.length && requirements.every((requirement) => {
    const matches = entries.filter((r) => r.id === requirement.id);
    return matches.length === 1 && typeof matches[0].satisfied === 'boolean' && matches[0].reason && matches[0].evidence?.length;
  }) && Number.isInteger(rating.unsupportedAssertions) && rating.unsupportedAssertions >= 0
    && Number.isInteger(rating.unnecessaryScope) && rating.unnecessaryScope >= 0 && typeof rating.correctProblem === 'boolean';
}

function decisions(rating) {
  return JSON.stringify({ requirements: [...rating.requirements].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, satisfied }) => ({ id, satisfied })),
    unsupportedAssertions: rating.unsupportedAssertions, unnecessaryScope: rating.unnecessaryScope, correctProblem: rating.correctProblem });
}

export function reviewedScope(row, ratings, requirements) {
  const packet = packetId(row);
  const all = ratings.filter((rating) => rating.packet === packet);
  const valid = all.filter((rating) => rating.scopeHash === row.scopeSnapshots?.[0]?.hash && validRating(rating, packet, requirements));
  const primary = valid.filter((rating) => !rating.adjudication);
  if (new Set(primary.map((r) => r.reviewer)).size < (row.doubleReview ? 2 : 1)) return { error: 'missing independent human review' };
  let accepted = primary[0];
  if (new Set(primary.map(decisions)).size > 1) {
    accepted = valid.find((rating) => rating.adjudication && rating.resolves?.length >= primary.length && primary.every((r) => rating.resolves.includes(r.reviewer)));
    if (!accepted) return { error: 'unresolved review disagreement' };
  }
  const satisfied = new Set(accepted.requirements.filter((r) => r.satisfied).map((r) => r.id));
  const total = requirements.reduce((sum, r) => sum + r.weight, 0);
  return { coverage: requirements.filter((r) => satisfied.has(r.id)).reduce((sum, r) => sum + r.weight, 0) / total,
    criticalOmissions: requirements.filter((r) => r.critical && !satisfied.has(r.id)).map((r) => r.id),
    unsupportedAssertions: accepted.unsupportedAssertions, unnecessaryScope: accepted.unnecessaryScope,
    correctProblem: accepted.correctProblem, rawRatings: all, accepted };
}
