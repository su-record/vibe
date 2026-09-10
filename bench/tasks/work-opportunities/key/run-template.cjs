const fs = require('node:fs');
const path = require('node:path');

function rows(file) {
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const header = lines.shift().split(',');
  if (header.join(',') !== 'event_id,date,team,status,blocker' || !lines.length) throw new Error('status input requires event_id,date,team,status,blocker and data rows');
  return lines.map((line) => Object.fromEntries(header.map((key, i) => [key, line.split(',')[i]])));
}

function status(input) {
  const unique = new Map();
  for (const row of rows(path.join(input, 'tables/status.csv'))) {
    if (!row.event_id || !row.date || !row.team || !row.status || row.blocker === undefined) throw new Error('invalid status row');
    const item = { eventId: row.event_id, date: row.date, team: row.team, status: row.status, blockers: row.blocker ? [row.blocker] : [], sourceRefs: [`tables/status.csv#${row.event_id}`] };
    if (unique.has(row.event_id) && JSON.stringify(unique.get(row.event_id)) !== JSON.stringify(item)) throw new Error('conflicting status event');
    unique.set(row.event_id, item);
  }
  return [...unique.values()].sort((a, b) => a.eventId.localeCompare(b.eventId));
}

function followup(input) {
  const names = fs.readdirSync(path.join(input, 'meetings')).filter((name) => name.endsWith('.json')).sort();
  if (!names.length) throw new Error('meeting input needs JSON notes');
  return names.flatMap((name) => {
    const meeting = JSON.parse(fs.readFileSync(path.join(input, 'meetings', name), 'utf8'));
    if (!Array.isArray(meeting.actions)) throw new Error('meeting notes require actions');
    return meeting.actions.map((action) => {
      if (!action.id || !action.text) throw new Error('an action requires id and text');
      const owner = action.owner ?? null, due = action.due ?? null;
      return { id: action.id, text: action.text, owner, due, uncertainties: [...(owner === null ? ['owner'] : []), ...(due === null ? ['due'] : [])], sourceRefs: [`meetings/${name}#${action.id}`] };
    });
  }).sort((a, b) => a.id.localeCompare(b.id));
}

try {
  const args = process.argv.slice(2), input = args[args.indexOf('--input') + 1], output = args[args.indexOf('--out') + 1];
  if (!args.includes('--input') || !args.includes('--out')) throw new Error('run requires --input and --out');
  const result = { kind: KIND, items: KIND === 'status' ? status(input) : followup(input), reviewRequired: true };
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'drafts.json'), `${JSON.stringify(result, null, 2)}\n`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
