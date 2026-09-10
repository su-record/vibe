const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { csv } = require('./evidence.cjs');
const { json } = require('./files.cjs');

function expectedDrafts(input, kind) {
  let items;
  if (kind === 'status') {
    const rows = csv(fs.readFileSync(path.join(input, 'tables/status.csv'), 'utf8'));
    assert.ok(rows.length, 'status input requires data rows');
    const unique = new Map();
    for (const row of rows) {
      if (!row.event_id || !row.date || !row.team || !row.status || row.blocker === undefined) throw new Error('status input requires event_id,date,team,status,blocker');
      const item = { eventId: row.event_id, date: row.date, team: row.team, status: row.status, blockers: row.blocker ? [row.blocker] : [], sourceRefs: [`tables/status.csv#${row.event_id}`] };
      if (unique.has(row.event_id)) assert.deepEqual(unique.get(row.event_id), item, 'conflicting status event');
      unique.set(row.event_id, item);
    }
    items = [...unique.values()].sort((a, b) => a.eventId.localeCompare(b.eventId));
  } else {
    const names = fs.readdirSync(path.join(input, 'meetings')).filter((name) => name.endsWith('.json')).sort();
    assert.ok(names.length, 'meeting input requires JSON notes');
    items = names.flatMap((name) => {
      const meeting = json(path.join(input, 'meetings', name));
      assert.ok(Array.isArray(meeting.actions), 'meeting input requires actions');
      return meeting.actions.map((action) => {
        assert.ok(action.id && action.text, 'each action requires id and text');
        const owner = action.owner ?? null, due = action.due ?? null;
        return { id: action.id, text: action.text, owner, due, uncertainties: [...(owner === null ? ['owner'] : []), ...(due === null ? ['due'] : [])], sourceRefs: [`meetings/${name}#${action.id}`] };
      });
    }).sort((a, b) => a.id.localeCompare(b.id));
  }
  return { kind, items, reviewRequired: true };
}

function assertDrafts(actual, expected) {
  assert.equal(actual.kind, expected.kind, 'selected pilot family');
  assert.equal(actual.reviewRequired, true, 'drafts need human review');
  assert.ok(Array.isArray(actual.items), 'draft output requires items');
  const required = expected.kind === 'status' ? ['eventId', 'date', 'team', 'status', 'blockers', 'sourceRefs'] : ['id', 'text', 'owner', 'due', 'uncertainties', 'sourceRefs'];
  const projected = actual.items.map((item) => Object.fromEntries(required.map((name) => [name, item[name]])));
  assert.deepEqual(projected, expected.items, 'drafts must reflect input content, missing fields and source references');
}

function changedInput(input, kind) {
  if (kind === 'status') {
    const file = path.join(input, 'tables/status.csv');
    const rows = csv(fs.readFileSync(file, 'utf8')).reverse();
    rows[0] = { ...rows[0], event_id: 'changed-status-93', date: '2027-01-08', status: 'blocked', blocker: 'Changed public test dependency' };
    fs.writeFileSync(file, `event_id,date,team,status,blocker\n${rows.map((row) => [row.event_id, row.date, row.team, row.status, row.blocker].join(',')).join('\n')}\n`);
  } else {
    const name = fs.readdirSync(path.join(input, 'meetings')).find((file) => file.endsWith('.json'));
    const file = path.join(input, 'meetings', name);
    const value = json(file);
    value.actions.reverse();
    value.actions[0] = { ...value.actions[0], id: 'changed-action-93', text: 'Changed public follow-up', owner: null, due: null };
    fs.writeFileSync(file, JSON.stringify(value));
  }
}

module.exports = { expectedDrafts, assertDrafts, changedInput };
