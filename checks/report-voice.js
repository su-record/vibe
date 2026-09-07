#!/usr/bin/env node
// Card rule 9 and the handoff skill's Report voice are present: the report separates what changed
// from what the harness verified, keeps the load-bearing caveat, and estimates in turns, not days.
import fs from 'node:fs';
import path from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const errors = [];
const card = fs.readFileSync(path.join(root, 'card.md'), 'utf-8');
const rule9 = card.split('\n').find((l) => l.startsWith('9. ')) ?? '';
for (const word of ['changed', 'verified', 'caveat']) if (!rule9.includes(word)) errors.push(`card.md rule 9 does not say "${word}"`);
if (!/vibe check/.test(rule9)) errors.push('card.md rule 9 does not name vibe check as the verifier');
const handoff = fs.readFileSync(path.join(root, 'skills', 'vibe-handoff', 'SKILL.md'), 'utf-8');
if (!handoff.split('\n').some((l) => l.trim() === '## Report voice')) errors.push('vibe-handoff: no "## Report voice" section');
if (!handoff.includes('not checked')) errors.push('vibe-handoff: no "not checked" rule');
if (!/turns and tool calls/.test(handoff)) errors.push('vibe-handoff: no turns-and-tool-calls estimate rule');
if (!/calendar time/.test(handoff)) errors.push('vibe-handoff: does not forbid human calendar time');
if (!/antislop-en/.test(handoff)) errors.push('vibe-handoff: the handoff document is not bound to antislop-en');
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('report voice in place: card rule 9 and vibe-handoff Report voice');
